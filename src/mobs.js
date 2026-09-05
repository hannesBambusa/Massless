// Hostiles. Four kinds (see mobtypes.js), each with its own design and behaviour, sharing one hit / hp interface.
// Shades throw bolts: visible tracers that fly to the ship and bleed its shield on arrival.
import * as THREE from 'three';
import { COLORS, MOB } from './config.js';
import { MOB_TYPES } from './mobtypes.js';
import { glowSprite, glowLineMat } from './materials.js';
import { rnd, damp, clamp, TAU, pick } from './utils.js';

const SAMPLES = 16;
const MAX_BOLTS = 80;

export class Mobs {
  /** sites: the site groups; wisps are few at harvest sites and swarm around rifts */
  constructor(scene, sites) {
    this.scene = scene;
    this.group = new THREE.Group(); scene.add(this.group);
    this.list = []; this.count = 0;
    this._d = new THREE.Vector3(); this._tmp = new THREE.Vector3(); this._want = new THREE.Vector3(); this._jink = new THREE.Vector3();
    // bolts: one LineSegments buffer for every tracer in flight
    this.bolts = [];
    this.boltPos = new Float32Array(MAX_BOLTS * 6);
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(this.boltPos, 3)); this.boltGeo = bg;
    this.boltLines = new THREE.LineSegments(bg, glowLineMat(MOB_TYPES.shade.bolt.color, 1.6, 0.95)); this.boltLines.frustumCulled = false; scene.add(this.boltLines);
    for (const st of sites) this.populate(st);
  }
  dispose() { this.scene.remove(this.group); this.scene.remove(this.boltLines); this.list = []; this.bolts = []; }
  shift(d) { for (const m of this.list) { m.position.sub(d); m.home.sub(d); } for (const b of this.bolts) { b.p.sub(d); } }

  /** spawn a site's hostiles: combat sites get a mix of every kind, harvest sites a lone wisp */
  populate(st) {
    if (st.type !== 'combat') { this.add('wisp', st.position, st); return; }
    const kinds = Object.keys(MOB_TYPES), bag = kinds.flatMap((k) => Array(MOB_TYPES[k].weight).fill(k));
    for (let n = 0; n < MOB.perCombatSite; n++) {
      const k = pick(bag);
      if (k !== 'shoal') { this.add(k, st.position, st); continue; }
      // a shoal is a pack: one spot near the site, the pack scattered tightly around it
      const spot = st.position.clone().add(new THREE.Vector3(rnd(-1, 1), rnd(-0.3, 0.3), rnd(-1, 1)).normalize().multiplyScalar(rnd(300, 520)));
      for (let i = 0; i < MOB_TYPES.shoal.pack; i++) this.add('shoal', spot, st, 25);
    }
  }
  add(kind, centre, site, spread = null) {
    const def = MOB_TYPES[kind], idx = this.count++;   // running counter so names stay unique after kills and respawns
    const g = new THREE.Group();
    g.position.copy(centre).add(new THREE.Vector3(rnd(-1, 1), rnd(-0.3, 0.3), rnd(-1, 1)).normalize().multiplyScalar(spread !== null ? rnd(5, spread) : rnd(300, 520)));
    g.home = g.position.clone(); g.name = `${def.name} ${String.fromCharCode(65 + (idx % 26))}-${Math.floor(idx / 26) + 1}`; g.kind = 'mob'; g.mobKind = kind; g.def = def; g.site = site;
    g.radius = def.radius; g.hpMax = g.hp = def.hp; g.shiver = 0; g.dead = false; g.t = rnd(0, 100); g.phase = rnd(0, TAU); g.boltT = rnd(0, 1);
    g.dots = [];   // damage over time: { dps, left, key }
    g.hit = (dmg, lock, weapon = 'lance') => { const r = def.resist[weapon] ?? 1; g.hp = Math.max(0, g.hp - dmg * r); g.shiver = Math.max(g.shiver, lock); g.aggro = true; g.lastHit = weapon; };
    this['build_' + kind](g);
    this.group.add(g); this.list.push(g);
    return g;
  }

  // ---- designs ----
  tendrils(g, n, color1, color2, len) {
    g.tendrils = [];
    for (let i = 0; i < n; i++) {
      const pos = new Float32Array(SAMPLES * 3), geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const line = new THREE.Line(geo, glowLineMat(i % 2 ? color1 : color2, 1.2, 0.8)); line.frustumCulled = false; g.add(line);
      g.tendrils.push({ pos, line, a: i / n * TAU, b: rnd(-0.8, 0.8), len: len * rnd(0.8, 1.2), sp: rnd(1.5, 3), ph: rnd(0, TAU), curve: new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]) });
    }
  }
  build_wisp(g) {
    g.add(new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 10), new THREE.MeshBasicMaterial({ color: 0x1a0410 })));
    g.glow = glowSprite(0xff3d7a, 5, 0.55); g.add(g.glow);
    g.add(glowSprite(COLORS.white, 1.2, 0.9));
    this.tendrils(g, 7, 0xff3d7a, 0xff8fb0, 4.5);
  }
  build_shade(g) {
    // a flat dark disc seen edge-on, a single cold eye, two long trailing filaments
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.25, 24), new THREE.MeshBasicMaterial({ color: 0x050a1c })); g.add(disc); g.disc = disc;
    g.add(new THREE.LineSegments(new THREE.EdgesGeometry(disc.geometry, 30), glowLineMat(0x60a5fa, 1.4, 0.7)));
    g.glow = glowSprite(0x60a5fa, 5, 0.4); g.add(g.glow);
    g.eye = glowSprite(COLORS.white, 1.6, 1); g.add(g.eye);
    this.tendrils(g, 2, 0x60a5fa, 0x9be7ff, 7);
  }
  build_maw(g) {
    // a ring of teeth: a spiky torus around a hot core, slowly rotating, opening as it bites
    const teeth = new THREE.Mesh(new THREE.TorusGeometry(5, 1.4, 5, 14), new THREE.MeshBasicMaterial({ color: 0x1a0a04 })); g.add(teeth); g.teeth = teeth;
    g.add(new THREE.LineSegments(new THREE.EdgesGeometry(teeth.geometry, 20), glowLineMat(0xffb347, 1.4, 0.8)));
    const core = new THREE.Mesh(new THREE.SphereGeometry(2.2, 14, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff9f43).multiplyScalar(0.9) })); g.add(core); g.core = core;
    g.glow = glowSprite(0xff9f43, 12, 0.5); g.add(g.glow);
    this.tendrils(g, 5, 0xff9f43, 0xff3d7a, 3);
  }
  build_shoal(g) {
    // a tiny wireframe tetrahedron with a short tail, cold blue-white
    const tet = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.TetrahedronGeometry(1.6, 0)), glowLineMat(0x9be7ff, 1.5, 0.9)); g.add(tet); g.tet = tet;
    g.glow = glowSprite(0x9be7ff, 2.6, 0.5); g.add(g.glow);
    this.tendrils(g, 1, 0x9be7ff, 0x9be7ff, 3);
  }

  // ---- behaviour ----
  update(dt, ship, onDeath) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const m = this.list[i], def = m.def; m.t += dt;
      for (let k = m.dots.length - 1; k >= 0; k--) { const d = m.dots[k]; m.hp = Math.max(0, m.hp - d.dps * dt); d.left -= dt; if (d.onTick) d.onTick(d.dps * dt); if (d.left <= 0) m.dots.splice(k, 1); }
      if (m.hp <= 0 && !m.dead) { m.dead = true; this.group.remove(m); this.list.splice(i, 1); if (onDeath) onDeath(m); continue; }
      const toShip = this._d.copy(ship.position).sub(m.position); const d = toShip.length();
      m.aggro = m.aggro || d < def.aggro; if (d > MOB.leashRange) m.aggro = false;
      m.hunting = !!m.aggro;
      m.vel = m.vel || new THREE.Vector3();
      if (m.aggro) {
        // close to hold range; shades hang back and strafe, shoals jink
        const side = this._tmp.set(-toShip.z, 0, toShip.x).normalize();
        let want;
        if (d > def.hold * 1.15) want = this._want.copy(toShip).normalize().multiplyScalar(def.speed);
        else if (d < def.hold * 0.85) want = this._want.copy(toShip).normalize().multiplyScalar(-def.speed * 0.7);
        else want = side.multiplyScalar(def.speed * (m.mobKind === 'shade' ? 0.9 : 0.7) * (Math.sin(m.t * 0.7 + m.phase) > 0 ? 1 : -1));
        if (m.mobKind === 'shoal') want.add(new THREE.Vector3(Math.sin(m.t * 6 + m.phase), Math.cos(m.t * 5 + m.phase) * 0.5, Math.cos(m.t * 6.5 + m.phase)).multiplyScalar(18));
        m.vel.lerp(want, damp(m.mobKind === 'maw' ? 0.7 : 1.4, dt));
        if (def.bite && d < def.bite) { ship.damage(def.dps * dt); m.biting = true; } else m.biting = false;
        if (def.bolt) { m.boltT -= dt; if (m.boltT <= 0 && d < def.aggro * 1.2) { m.boltT = def.bolt.every * rnd(0.8, 1.2); this.fireBolt(m, ship); } }
      } else {
        const a = m.t * 0.25 + m.phase, goal = this._tmp.copy(m.home).add(new THREE.Vector3(Math.cos(a) * 60, Math.sin(a * 0.7) * 12, Math.sin(a) * 60));
        m.vel.lerp(goal.sub(m.position).multiplyScalar(0.4), damp(0.8, dt));
        m.biting = false;
      }
      m.position.addScaledVector(m.vel, dt);
      this.animate(m, dt, toShip, d);
    }
    this.updateBolts(dt, ship);
  }

  animate(m, dt, toShip, d) {
    const rate = m.hunting ? 2.2 : 1, sh = m.shiver; m.shiver = Math.max(0, sh - dt * 1.5);
    m.glow.scale.setScalar((m.mobKind === 'maw' ? 11 : m.mobKind === 'shoal' ? 2.4 : 4.5) + sh * 3 + Math.sin(m.t * 6) * 0.4 * rate);
    m.glow.material.opacity = 0.45 + sh * 0.4 + (m.hunting ? 0.2 : 0);
    if (m.mobKind === 'shade') { m.disc.lookAt(m.position.clone().add(toShip)); m.disc.rotateX(Math.PI / 2); m.eye.scale.setScalar(1.4 + (m.boltT < 0.3 ? 1.2 : 0)); }
    if (m.mobKind === 'maw') { m.teeth.rotation.z += dt * (0.6 + (m.biting ? 4 : 0)); m.teeth.rotation.x = Math.sin(m.t * 0.8) * 0.4; m.teeth.scale.setScalar(m.biting ? 1.25 + Math.sin(m.t * 20) * 0.1 : 1); m.core.scale.setScalar(1 + sh * 0.5 + Math.sin(m.t * 3) * 0.08); }
    if (m.mobKind === 'shoal') { m.tet.rotation.x += dt * 3; m.tet.rotation.y += dt * 4; }
    for (const td of m.tendrils) {
      const p = td.curve.points, a = td.a + Math.sin(m.t * td.sp * rate + td.ph) * 0.5, b = td.b + Math.cos(m.t * td.sp * 0.7 + td.ph) * 0.4;
      const dir = new THREE.Vector3(Math.cos(a) * Math.cos(b), Math.sin(b), Math.sin(a) * Math.cos(b));
      if (m.mobKind === 'shoal' || m.mobKind === 'shade') dir.copy(m.vel).normalize().negate().add(dir.multiplyScalar(0.3)).normalize();   // trail behind
      for (let c = 0; c < 4; c++) { const f = c / 3; p[c].copy(dir).multiplyScalar(0.8 + td.len * f).add(new THREE.Vector3(Math.sin(m.t * 5 + c + td.ph) * 0.5 * f, Math.cos(m.t * 4 + c) * 0.5 * f, 0)); }
      td.curve.updateArcLengths();
      for (let k = 0; k < SAMPLES; k++) { td.curve.getPoint(k / (SAMPLES - 1), this._tmp); td.pos.set([this._tmp.x, this._tmp.y, this._tmp.z], k * 3); }
      td.line.geometry.attributes.position.needsUpdate = true;
      td.line.material.opacity = 0.5 + 0.4 * Math.sin(m.t * 7 + td.ph) + sh * 0.4;
    }
  }

  // ---- bolts ----
  fireBolt(m, ship) {
    if (this.bolts.length >= MAX_BOLTS) return;
    const dir = ship.position.clone().sub(m.position).normalize();
    this.bolts.push({ p: m.position.clone(), v: dir.multiplyScalar(m.def.bolt.speed), dmg: m.def.bolt.dmg, life: 4, len: 6 });
  }
  updateBolts(dt, ship) {
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i]; b.life -= dt;
      // home gently so they connect, then hit within a few metres of the core
      const to = this._tmp.copy(ship.position).sub(b.p); const d = to.length();
      b.v.lerp(to.normalize().multiplyScalar(b.v.length()), damp(2.5, dt));
      b.p.addScaledVector(b.v, dt);
      if (d < 4) { ship.damage(b.dmg); this.bolts.splice(i, 1); continue; }
      if (b.life <= 0) { this.bolts.splice(i, 1); continue; }
    }
    for (let i = 0; i < this.bolts.length; i++) {
      const b = this.bolts[i], t = this._tmp.copy(b.v).normalize().multiplyScalar(-b.len);
      this.boltPos.set([b.p.x, b.p.y, b.p.z, b.p.x + t.x, b.p.y + t.y, b.p.z + t.z], i * 6);
    }
    this.boltGeo.setDrawRange(0, this.bolts.length * 2);   // only the bolts in flight are drawn
    this.boltGeo.attributes.position.needsUpdate = true;
  }
}
