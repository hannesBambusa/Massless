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
    // a cone of light ahead and a glow behind
    this.write();
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
    this.stretch = 1 + Math.min(6, speed / 400) + jump * 12;
    const v = Math.min(400, speed * 0.6) * dt;   // streaks flow backward (+z)
    for (const s of this.seed) { s.z += v; if (s.z > LEN) s.z -= LEN * 2; }
    this.write();
  }
}
