// Resonance lance: a sustained beam from the core to the target. Lock builds while the target stays in range; damage scales
// with lock. Visual: a bundle of living strands between core and target, colour shifting from cyan (tuning) to white-gold (locked),
// an impact bloom and sparks at the far end.
import * as THREE from 'three';
import { COLORS, LANCE } from '../config.js';
import { glowSprite } from '../materials.js';
import { rnd, damp, clamp, TAU } from '../utils.js';

const STRANDS = 5, SAMPLES = 24, SPARKS = 40, SIPHON = 110;
const cCyan = new THREE.Color(COLORS.cyan), cGold = new THREE.Color(COLORS.gold), cWhite = new THREE.Color(COLORS.white);

export class Lance {
  constructor(scene, ship) {
    this.scene = scene; this.ship = ship;
    this.target = null; this.lock = 0; this.on = false; this.t = 0;
    this.group = new THREE.Group(); this.group.visible = false; scene.add(this.group);
    // geometry is rewritten every frame far from where it was created, so never let the renderer cull it by its stale bounds
    const noCull = (o) => { o.frustumCulled = false; return o; };
    this.strands = [];
    for (let i = 0; i < STRANDS; i++) {
      const pos = new Float32Array(SAMPLES * 3), geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.LineBasicMaterial({ color: cCyan.clone(), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
      const line = noCull(new THREE.Line(geo, mat)); this.group.add(line);
      this.strands.push({ line, pos, mat, phase: rnd(0, TAU), speed: rnd(2, 4), r: i === 0 ? 0 : rnd(0.3, 0.9), curve: new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], false, 'catmullrom', 0.5) });
    }
    this.impact = glowSprite(COLORS.white, 4, 0.9); this.group.add(this.impact);
    this.impact2 = glowSprite(COLORS.gold, 9, 0.4); this.group.add(this.impact2);
    this.muzzle = glowSprite(COLORS.cyan, 3, 0.7); this.group.add(this.muzzle);
    const spos = new Float32Array(SPARKS * 3); this.spos = spos; this.sparks = Array.from({ length: SPARKS }, () => ({ v: new THREE.Vector3(), p: new THREE.Vector3(), life: 0 }));
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(spos, 3)); this.sgeo = sg;
    this.group.add(noCull(new THREE.Points(sg, new THREE.PointsMaterial({ color: new THREE.Color(COLORS.gold).multiplyScalar(1.4), size: 0.5, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }))));
    // siphon: motes torn out of a condensate that ride the beam into the core
    const qpos = new Float32Array(SIPHON * 3); this.qpos = qpos;
    this.siphon = Array.from({ length: SIPHON }, () => ({ t: -1, v: rnd(0.5, 1.1), off: rnd(0, TAU), r: rnd(0.4, 1.6) }));
    const qg = new THREE.BufferGeometry(); qg.setAttribute('position', new THREE.BufferAttribute(qpos, 3)); this.qgeo = qg;
    this.qmat = new THREE.PointsMaterial({ color: new THREE.Color(COLORS.gold).multiplyScalar(1.5), size: 0.7, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    this.group.add(noCull(new THREE.Points(qg, this.qmat)));
    this._a = new THREE.Vector3(); this._b = new THREE.Vector3(); this._d = new THREE.Vector3(); this._n = new THREE.Vector3(); this._u = new THREE.Vector3(); this._tmp = new THREE.Vector3();
  }

  toggle(target) { if (this.on && this.target === target) this.stop(); else this.fire(target); }
  fire(target) { if (!target || !target.hp) return false; if (this.target !== target) this.lock = 0; this.target = target; this.on = true; return true; }
  stop() { this.on = false; }
  get inRange() { return this.target && this.target.position.distanceTo(this.ship.position) - this.target.radius <= LANCE.range; }
  /** what this weapon is called against the current target: a siphon on a condensate, a lance on anything else */
  get label() { return this.target && this.target.kind === 'cloud' ? 'Siphon' : 'Lance'; }
  describe() { if (!this.on || !this.target) return ''; const n = this.label; return this.inRange ? (this.lock < 1 ? `Tuning ${n.toLowerCase()} to ${this.target.name} ${Math.round(this.lock * 100)}%` : `${n} locked on ${this.target.name}`) : `${this.target.name} out of ${n.toLowerCase()} range`; }

  update(dt) {
    this.t += dt;
    if (this.on && this.target && (this.target.dead || !this.target.hp)) { this.on = false; this.target = null; }
    const active = this.on && this.target && this.inRange;
    this.lock = clamp(this.lock + (active ? dt / LANCE.lockTime : -dt / LANCE.lockDecay), 0, 1);
    if (active) this.target.hit(LANCE.dps * (0.15 + 0.85 * this.lock * this.lock) * dt, this.lock);
    const show = this.on && this.target && this.lock > 0.02;
    this.group.visible = !!show;
    if (!show) return;
    const L = this.lock;
    const a = this._a.copy(this.ship.position), b = this._b.copy(this.target.position);
    this._d.copy(b).sub(a); const len = this._d.length(); this._d.normalize();
    // pull the end point onto the target's surface, facing us
    b.addScaledVector(this._d, -this.target.radius * 0.8);
    this._n.set(0, 1, 0).cross(this._d).normalize(); this._u.crossVectors(this._d, this._n).normalize();
    const harvesting = this.target.kind === 'cloud';
    const tint = harvesting && this.target.tint !== undefined ? new THREE.Color(this.target.tint) : cGold;   // harvest takes the cloud's colour
    const colour = cCyan.clone().lerp(cWhite, L * 0.7).lerp(tint, harvesting ? L * 0.9 : L * L * 0.5).multiplyScalar(1 + L * 0.8);
    this.qmat.color.copy(tint).multiplyScalar(1.5); this.impact2.material.color.copy(harvesting ? tint : cGold);
    for (const s of this.strands) {
      const pts = s.curve.points;
      for (let c = 0; c < 4; c++) {
        const f = c / 3, wob = (c === 0 || c === 3) ? 0 : (s.r * (1.2 - L * 0.8) + 0.25) * (0.4 + len * 0.02);
        const ang = this.t * s.speed + s.phase + c * 1.7;
        pts[c].copy(a).lerp(b, f).addScaledVector(this._n, Math.cos(ang) * wob).addScaledVector(this._u, Math.sin(ang) * wob);
      }
      s.curve.updateArcLengths();
      for (let i = 0; i < SAMPLES; i++) { s.curve.getPoint(i / (SAMPLES - 1), this._tmp); s.pos.set([this._tmp.x, this._tmp.y, this._tmp.z], i * 3); }
      s.line.geometry.attributes.position.needsUpdate = true;
      s.mat.color.copy(colour); s.mat.opacity = (0.35 + L * 0.55) * (0.7 + 0.3 * Math.sin(this.t * 9 + s.phase));
    }
    this.impact.position.copy(b); this.impact.scale.setScalar(2 + L * 4 + Math.sin(this.t * 12) * 0.6); this.impact.material.opacity = 0.3 + L * 0.6;
    this.impact2.position.copy(b); this.impact2.scale.setScalar(5 + L * 10); this.impact2.material.opacity = L * 0.4;
    this.muzzle.position.copy(a); this.muzzle.scale.setScalar(2 + L * 2);
    // sparks off the impact point
    for (let i = 0; i < SPARKS; i++) {
      const sp = this.sparks[i]; sp.life -= dt;
      if (sp.life <= 0 && L > 0.3 && Math.random() < 0.3) { sp.life = rnd(0.2, 0.6); sp.p.copy(b); sp.v.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(6, 16) * L); }
      if (sp.life > 0) sp.p.addScaledVector(sp.v, dt); else sp.p.set(0, -1e6, 0);
      this.spos.set([sp.p.x, sp.p.y, sp.p.z], i * 3);
    }
    this.sgeo.attributes.position.needsUpdate = true;
    // siphon motes: spawn on the condensate's surface, travel the central strand to the core, curling around it
    const cloud = this.target.kind === 'cloud';
    const curve = this.strands[0].curve;
    for (let i = 0; i < SIPHON; i++) {
      const q = this.siphon[i];
      if (q.t < 0) { if (cloud && L > 0.25 && Math.random() < 0.6 * L) q.t = 0; else { this.qpos.set([0, -1e6, 0], i * 3); continue; } }
      q.t += q.v * dt * (0.8 + L);                           // faster as the lock deepens
      if (q.t >= 1) { q.t = -1; this.qpos.set([0, -1e6, 0], i * 3); continue; }
      curve.getPoint(1 - q.t, this._tmp);                    // strand runs core -> target; motes go the other way
      const ang = q.off + q.t * 9, rad = q.r * (1 - q.t) * 1.2;   // spiral tightens toward the core
      this._tmp.addScaledVector(this._n, Math.cos(ang) * rad).addScaledVector(this._u, Math.sin(ang) * rad);
      this.qpos.set([this._tmp.x, this._tmp.y, this._tmp.z], i * 3);
    }
    this.qgeo.attributes.position.needsUpdate = true;
  }
}
