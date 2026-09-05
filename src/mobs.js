// Wisps: hostile energy entities. A dark core wrapped in writhing red-magenta tendrils. They drift around their spawn,
// hunt the ship when it comes close, and bleed its shield while in reach. Same hit / hp interface as condensates.
import * as THREE from 'three';
import { COLORS, MOB } from './config.js';
import { glowSprite } from './materials.js';
import { rnd, damp, clamp, TAU } from './utils.js';

const TENDRILS = 7, SAMPLES = 16;

export class Mobs {
  /** sites: the site groups; wisps are few at harvest sites and swarm around rifts */
  constructor(scene, sites) {
    this.group = new THREE.Group(); scene.add(this.group);
    this.list = [];
    let n = 0;
    for (const st of sites) this.populate(st);
  }
  populate(st) {
    for (let i = 0, c = st.type === 'combat' ? MOB.perCombatSite : MOB.perSite; i < c; i++) { const m = this.spawn(st.position, this.list.length); m.site = st; this.list.push(m); }
    this._d = new THREE.Vector3(); this._tmp = new THREE.Vector3();
  }

  spawn(centre, idx) {
    const g = new THREE.Group();
    g.position.copy(centre).add(new THREE.Vector3(rnd(-1, 1), rnd(-0.3, 0.3), rnd(-1, 1)).normalize().multiplyScalar(rnd(300, 520)));
    g.home = g.position.clone(); g.name = `Wisp ${String.fromCharCode(65 + (idx % 26))}-${Math.floor(idx / 26) + 1}`; g.kind = 'mob';
    g.radius = 4; g.hpMax = g.hp = MOB.hp; g.shiver = 0; g.dead = false; g.t = rnd(0, 100); g.phase = rnd(0, TAU);
    g.hit = (dmg, lock) => { g.hp = Math.max(0, g.hp - dmg); g.shiver = Math.max(g.shiver, lock); g.aggro = true; };
    g.add(new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 10), new THREE.MeshBasicMaterial({ color: 0x1a0410 })));
    const glow = glowSprite(0xff3d7a, 5, 0.55); g.add(glow); g.glow = glow;
    const eye = glowSprite(COLORS.white, 1.2, 0.9); g.add(eye);
    g.tendrils = [];
    for (let i = 0; i < TENDRILS; i++) {
      const pos = new Float32Array(SAMPLES * 3), geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: new THREE.Color(i % 2 ? 0xff3d7a : 0xff8fb0).multiplyScalar(1.2), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
      line.frustumCulled = false; g.add(line);
      const a = i / TENDRILS * TAU, b = rnd(-0.8, 0.8);
      g.tendrils.push({ pos, line, a, b, len: rnd(3, 5.5), sp: rnd(1.5, 3), ph: rnd(0, TAU), curve: new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]) });
    }
    this.group.add(g);
    return g;
  }

  /** floating origin */
  shift(d) { for (const m of this.list) { m.position.sub(d); m.home.sub(d); } }
  dispose() { this.group.parent && this.group.parent.remove(this.group); if (this.tethers) this.tethers.parent && this.tethers.parent.remove(this.tethers); this.list = []; if (this.items) this.items = []; }
  update(dt, ship, onDeath) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const m = this.list[i]; m.t += dt;
      if (m.hp <= 0 && !m.dead) { m.dead = true; this.group.remove(m); this.list.splice(i, 1); if (onDeath) onDeath(m); continue; }
      // behaviour: hunt when the ship is near, otherwise wander around home
      const toShip = this._d.copy(ship.position).sub(m.position); const d = toShip.length();
      m.aggro = m.aggro || d < MOB.aggroRange; if (d > MOB.leashRange) m.aggro = false;
      m.hunting = !!m.aggro;
      if (m.aggro) {
        const want = d > MOB.holdRange ? toShip.normalize().multiplyScalar(MOB.speed) : this._tmp.set(-toShip.z, 0, toShip.x).normalize().multiplyScalar(MOB.speed * 0.7);
        m.vel = m.vel || new THREE.Vector3(); m.vel.lerp(want, damp(1.2, dt));
        if (d < MOB.biteRange) ship.damage(MOB.dps * dt);
      } else {
        const a = m.t * 0.25 + m.phase, goal = this._tmp.copy(m.home).add(new THREE.Vector3(Math.cos(a) * 60, Math.sin(a * 0.7) * 12, Math.sin(a) * 60));
        m.vel = m.vel || new THREE.Vector3(); m.vel.lerp(goal.sub(m.position).multiplyScalar(0.4), damp(0.8, dt));
      }
      m.position.addScaledVector(m.vel, dt);
      // visuals: tendrils writhe, faster when hunting; glow flares when hit
      const rate = m.hunting ? 2.2 : 1, sh = m.shiver; m.shiver = Math.max(0, sh - dt * 1.5);
      m.glow.scale.setScalar(4.5 + sh * 3 + Math.sin(m.t * 6) * 0.4 * rate); m.glow.material.opacity = 0.45 + sh * 0.4 + (m.hunting ? 0.2 : 0);
      for (const td of m.tendrils) {
        const p = td.curve.points, a = td.a + Math.sin(m.t * td.sp * rate + td.ph) * 0.5, b = td.b + Math.cos(m.t * td.sp * 0.7 + td.ph) * 0.4;
        const dir = new THREE.Vector3(Math.cos(a) * Math.cos(b), Math.sin(b), Math.sin(a) * Math.cos(b));
        for (let c = 0; c < 4; c++) { const f = c / 3; p[c].copy(dir).multiplyScalar(0.8 + td.len * f).add(new THREE.Vector3(Math.sin(m.t * 5 + c + td.ph) * 0.5 * f, Math.cos(m.t * 4 + c) * 0.5 * f, 0)); }
        td.curve.updateArcLengths();
        for (let k = 0; k < SAMPLES; k++) { td.curve.getPoint(k / (SAMPLES - 1), this._tmp); td.pos.set([this._tmp.x, this._tmp.y, this._tmp.z], k * 3); }
        td.line.geometry.attributes.position.needsUpdate = true;
        td.line.material.opacity = 0.5 + 0.4 * Math.sin(m.t * 7 + td.ph) + sh * 0.4;
      }
    }
  }
}
