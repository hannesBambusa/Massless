// Warp tunnel: streaks rushing past the ship along its axis while in warp. Lives in ship space, fades with the warp weight.
import * as THREE from 'three';
import { COLORS } from './config.js';
import { rnd, TAU } from './utils.js';

const N = 420, LEN = 160, R0 = 4, R1 = 34;   // wide enough to surround a close camera

export class WarpFx {
  constructor(parent) {
    this.pos = new Float32Array(N * 6);
    this.seed = [];
    for (let i = 0; i < N; i++) {
      const a = rnd(0, TAU), r = rnd(R0, R1), z = rnd(-LEN, LEN), l = rnd(2, 9);
      this.seed.push({ a, r, z, l });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.mat = new THREE.LineBasicMaterial({ color: new THREE.Color(COLORS.ice).multiplyScalar(1.3), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    this.lines = new THREE.LineSegments(geo, this.mat);
    this.lines.visible = false; this.lines.frustumCulled = false;
    parent.add(this.lines);
    this.write();
    // spool rings: three big rings that turn and contract onto the ship as the fold winds up
    const ringPts = []; for (let i = 0; i <= 96; i++) { const a = i / 96 * TAU; ringPts.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0)); }
    const rg = new THREE.BufferGeometry().setFromPoints(ringPts);
    this.rings = [0, 1, 2].map((i) => {
      const r = new THREE.LineLoop(rg, new THREE.LineBasicMaterial({ color: new THREE.Color(0x9f8cff).multiplyScalar(1.5), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      r.i = i; r.visible = false; r.frustumCulled = false; parent.add(r); return r;
    });
    this.spoolT = 0;
  }
  /** w: spool weight 0..1 (rings contract), jump: fold weight (rings fade out as the fold takes over) */
  spool(dt, w, jump) {
    this.spoolT += dt;
    for (const r of this.rings) {
      const on = w > 0.01; r.visible = on; if (!on) continue;
      const k = (r.i + 1) / 3;
      r.scale.setScalar(4 + (1 - w) * (30 + r.i * 18) + Math.sin(this.spoolT * 3 + r.i) * 0.6);
      r.rotation.set(Math.sin(this.spoolT * 0.5 + r.i) * 0.8, this.spoolT * (0.4 + r.i * 0.25) * k, Math.cos(this.spoolT * 0.4 + r.i * 2) * 0.8);
      r.material.opacity = (0.25 + w * 0.55) * (1 - jump * 0.6);
    }
  }
  write() {
    for (let i = 0; i < N; i++) {
      const s = this.seed[i], x = Math.cos(s.a) * s.r, y = Math.sin(s.a) * s.r;
      this.pos.set([x, y, s.z, x, y, s.z + s.l * this.stretch], i * 6);
    }
    this.lines.geometry.attributes.position.needsUpdate = true;
  }
  /** w: warp weight 0..1, speed: current warp speed (world units/s) */
  update(dt, w, speed, jump = 0) {
    this.lines.visible = w > 0.02;
    if (!this.lines.visible) return;
    this.mat.opacity = w * 0.7 * (1 - jump);   // no streaks through a fold: space bends instead
    // jump: the streaks go violet-white and stretch far longer
    this.mat.color.setRGB(0.6 + jump * 0.4, 0.9 - jump * 0.3, 1.0).multiplyScalar(1.3 + jump * 0.6);
    this.stretch = 1 + 6 * w + jump * 12;                   // streak length follows the warp weight, not the raw speed
    const v = 400 * w * dt;                                   // streaks flow backward (+z)
    for (const s of this.seed) { s.z += v; if (s.z > LEN) s.z -= LEN * 2; }
    this.write();
  }
}
