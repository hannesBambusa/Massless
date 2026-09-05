// The other three weapons. Each unbinds in its own way and has its own cooldown; the lance stays a sustained beam.
//   pulse    - Unbinding pulse: a ring thrown off the ship, hurting everything within reach and shoving it back
//   filament - a strand thrown at the target that wraps it, drains it over time and knits your shield with what it takes
//   fracture - a shard of your own lattice, fired hard: burst damage, costs a sliver of hull
import * as THREE from 'three';
import { COLORS, WEAPONS } from '../config.js';
import { glowSprite, glowLineMat } from '../materials.js';
import { rnd, TAU, clamp } from '../utils.js';

const ring = (r, mat) => { const pts = []; for (let i = 0; i <= 72; i++) { const a = i / 72 * TAU; pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); } const l = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), mat); l.frustumCulled = false; return l; };

export class Arsenal {
  constructor(scene, ship, mobs) {
    this.scene = scene; this.ship = ship; this.mobs = mobs;
    this.cd = { pulse: 0, filament: 0, fracture: 0 };
    this.effects = [];
    this.group = new THREE.Group(); scene.add(this.group);
  }
  ready(key) { return this.cd[key] <= 0; }
  /** 0..1 fraction of the cooldown still to go */
  cooldown(key) { return clamp(this.cd[key] / WEAPONS[key].cooldown, 0, 1); }

  /** fire a weapon at the target (pulse needs none). Returns a string reason when it can't. */
  fire(key, target) {
    if (!this.ready(key)) return 'recharging';
    const w = WEAPONS[key];
    if (key === 'pulse') return this.pulse(w);
    if (!target || target.kind !== 'mob' || target.dead) return 'no target';
    const d = target.position.distanceTo(this.ship.position) - target.radius;
    if (d > w.range) return 'range';
    if (key === 'filament') return this.filament(w, target);
    if (key === 'fracture') return this.fracture(w, target);
  }

  pulse(w) {
    this.cd.pulse = w.cooldown;
    const p = this.ship.position;
    for (const m of this.mobs.list) {
      const d = m.position.distanceTo(p);
      if (d < w.range) {
        m.hit(w.dmg * (1 - 0.5 * d / w.range), 1, 'pulse');
        m.vel = m.vel || new THREE.Vector3(); m.vel.add(m.position.clone().sub(p).normalize().multiplyScalar(w.shove));
      }
    }
    // three rings expand out from the ship, tilted like the vessel's halo
    for (let i = 0; i < 3; i++) {
      const r = ring(1, glowLineMat(i ? COLORS.ice : COLORS.cyan, 1.6, 0.9)); r.rotation.set(rnd(-0.5, 0.5), rnd(0, TAU), rnd(-0.5, 0.5));
      this.group.add(r); this.effects.push({ kind: 'ring', obj: r, t: -i * 0.08, life: 0.7, range: w.range });
    }
    const flash = glowSprite(COLORS.white, 6, 0.9); this.group.add(flash); this.effects.push({ kind: 'flash', obj: flash, t: 0, life: 0.35 });
    return null;
  }

  filament(w, target) {
    this.cd.filament = w.cooldown;
    // a strand that flies out, wraps the target and drains it: damage over time, a share of it knits our shield
    const pos = new Float32Array(30 * 3), geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const line = new THREE.Line(geo, glowLineMat(COLORS.violet, 1.5, 0.95)); line.frustumCulled = false; this.group.add(line);
    const ship = this.ship;
    const fx = { kind: 'filament', obj: line, pos, target, t: 0, life: w.duration + 0.5, fly: 0.45, phase: rnd(0, TAU) };
    target.dots.push({ dps: w.dps * (target.def.resist.filament ?? 1), left: w.duration, key: 'filament', onTick: (n) => { ship.shield = Math.min(ship.shieldMax, ship.shield + n * w.leech); } });
    target.aggro = true;
    this.effects.push(fx);
    return null;
  }

  fracture(w, target) {
    this.cd.fracture = w.cooldown;
    this.ship.hull = Math.max(1, this.ship.hull - w.hullCost);
    // a spinning wireframe shard flies to the target and shatters it
    const shard = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.OctahedronGeometry(1.2, 0)), glowLineMat(COLORS.gold, 1.8, 1)); shard.frustumCulled = false;
    shard.position.copy(this.ship.position); this.group.add(shard);
    this.effects.push({ kind: 'shard', obj: shard, target, t: 0, life: 2, speed: w.speed, dmg: w.dmg, spin: new THREE.Vector3(rnd(-8, 8), rnd(-8, 8), rnd(-8, 8)) });
    return null;
  }

  update(dt) {
    for (const k in this.cd) this.cd[k] = Math.max(0, this.cd[k] - dt);
    const ship = this.ship;
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i]; e.t += dt;
      if (e.kind === 'ring') {
        if (e.t < 0) { e.obj.visible = false; continue; }
        e.obj.visible = true; e.obj.position.copy(ship.position);
        const f = e.t / e.life; e.obj.scale.setScalar(1 + f * e.range); e.obj.material.opacity = (1 - f) * 0.9;
      } else if (e.kind === 'flash') {
        e.obj.position.copy(ship.position); e.obj.scale.setScalar(6 + e.t * 40); e.obj.material.opacity = 0.9 * (1 - e.t / e.life);
      } else if (e.kind === 'filament') {
        const T = e.target; if (T.dead) { e.t = e.life; }
        else {
          // fly out for `fly` seconds, then stay wrapped: a helix around the line from ship to target, tightening on the target
          const f = clamp(e.t / e.fly, 0, 1), a = ship.position, b = T.position;
          const dir = b.clone().sub(a), len = dir.length(); dir.normalize();
          const n = new THREE.Vector3(0, 1, 0).cross(dir).normalize(), u = dir.clone().cross(n);
          for (let k = 0; k < 30; k++) {
            const s = k / 29, reach = s * f, ang = e.phase + s * 14 + e.t * 9, r = (0.3 + s * 1.2) * (1 - f * 0.4) + (s > 0.85 ? (T.radius + 1) * (s - 0.85) / 0.15 * f : 0);
            const p = a.clone().addScaledVector(dir, len * reach).addScaledVector(n, Math.cos(ang) * r).addScaledVector(u, Math.sin(ang) * r);
            e.pos.set([p.x, p.y, p.z], k * 3);
          }
          e.obj.geometry.attributes.position.needsUpdate = true;
          e.obj.material.opacity = 0.95 * clamp((e.life - e.t) / 0.5, 0, 1);
        }
      } else if (e.kind === 'shard') {
        const T = e.target;
        e.obj.rotation.x += e.spin.x * dt; e.obj.rotation.y += e.spin.y * dt;
        if (!T.dead) {
          const to = T.position.clone().sub(e.obj.position), d = to.length();
          e.obj.position.addScaledVector(to.normalize(), Math.min(d, e.speed * dt));
          if (d < T.radius + 1.5) {
            T.hit(e.dmg, 1, 'fracture');
            const flash = glowSprite(COLORS.gold, 3, 1); flash.position.copy(T.position); this.group.add(flash); this.effects.push({ kind: 'flashAt', obj: flash, t: 0, life: 0.4 });
            e.t = e.life;
          }
        } else e.t = e.life;
      } else if (e.kind === 'flashAt') {
        e.obj.scale.setScalar(3 + e.t * 30); e.obj.material.opacity = 1 - e.t / e.life;
      }
      if (e.t >= e.life) { this.group.remove(e.obj); this.effects.splice(i, 1); }
    }
  }
  shift(d) { for (const e of this.effects) if (e.kind === 'shard' || e.kind === 'flashAt') e.obj.position.sub(d); }
  /** drop every effect in flight, for a system swap */
  reset() { for (const e of this.effects) this.group.remove(e.obj); this.effects = []; }
}
