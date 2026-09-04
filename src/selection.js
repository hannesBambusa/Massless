// Selected object: a living ring around it, camera-facing. A softly breathing circle, short hairs swaying off it like the
// HUD core, and a few motes drifting round. Subtle: thin lines, low alpha, slow motion.
import * as THREE from 'three';
import { COLORS } from './config.js';
import { rnd, TAU, damp } from './utils.js';

const HAIRS = 18, SEG = 6, MOTES = 8, RING = 72;

export class Selection {
  constructor(scene, camera) {
    this.camera = camera;
    this.obj = null;
    this.group = new THREE.Group(); this.group.visible = false; scene.add(this.group);
    const mat = (op) => new THREE.LineBasicMaterial({ color: new THREE.Color(COLORS.gold).multiplyScalar(1.2), transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false });
    // ring
    this.ringPos = new Float32Array((RING + 1) * 3);
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(this.ringPos, 3));
    this.ring = new THREE.Line(rg, mat(0.55)); this.ring.frustumCulled = false; this.group.add(this.ring);
    // hairs: HAIRS strands of SEG segments, as one LineSegments buffer
    this.hairPos = new Float32Array(HAIRS * SEG * 2 * 3);
    const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.BufferAttribute(this.hairPos, 3));
    this.hairs = new THREE.LineSegments(hg, mat(0.35)); this.hairs.frustumCulled = false; this.group.add(this.hairs);
    this.hair = Array.from({ length: HAIRS }, (_, i) => ({ a: i / HAIRS * TAU + rnd(-0.06, 0.06), ph: rnd(0, TAU), sp: rnd(0.5, 1.1), len: rnd(0.12, 0.26) }));
    // motes
    this.motePos = new Float32Array(MOTES * 3);
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(this.motePos, 3));
    this.motes = new THREE.Points(mg, new THREE.PointsMaterial({ color: COLORS.white, size: 0.35, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
    this.motes.frustumCulled = false; this.group.add(this.motes);
    this.mote = Array.from({ length: MOTES }, () => ({ a: rnd(0, TAU), w: rnd(0.2, 0.5) * (Math.random() < 0.5 ? 1 : -1), r: rnd(1.05, 1.3) }));
    this.t = 0; this.pop = 0; this.scale = 1;
    this.listeners = [];
  }
  onChange(fn) { this.listeners.push(fn); }
  set(obj) { if (this.obj === obj) return; this.obj = obj; this.pop = 1; for (const fn of this.listeners) fn(obj); }
  clear() { this.set(null); }

  update(dt) {
    this.group.visible = !!this.obj;
    if (!this.obj) return;
    this.t += dt; this.pop = Math.max(0, this.pop - dt * 2.5);
    const t = this.t, R = (this.obj.radius + 3) * (1 + this.pop * 0.35);
    this.group.position.copy(this.obj.position);
    this.group.quaternion.copy(this.camera.quaternion);
    // breathing ring with a slow ripple
    for (let i = 0; i <= RING; i++) {
      const a = i / RING * TAU, rr = R * (1 + 0.012 * Math.sin(a * 3 + t * 1.2) + 0.008 * Math.sin(a * 7 - t * 0.8));
      this.ringPos.set([Math.cos(a) * rr, Math.sin(a) * rr, 0], i * 3);
    }
    this.ring.geometry.attributes.position.needsUpdate = true;
    this.ring.material.opacity = 0.45 + 0.1 * Math.sin(t * 1.5) + this.pop * 0.5;
    // hairs: rooted on the ring, swaying with a shared current, displacement growing toward the tip
    const cx = Math.sin(t * 0.4) * 0.5 + Math.sin(t * 0.13) * 0.3, cy = Math.cos(t * 0.31) * 0.5;
    let k = 0;
    for (const h of this.hair) {
      const dx = Math.cos(h.a), dy = Math.sin(h.a), nx = -dy, ny = dx, reach = R * h.len * (1 + this.pop * 0.8);
      let px = dx * R, py = dy * R;
      for (let i = 1; i <= SEG; i++) {
        const f = i / SEG, g = Math.pow(f, 1.6);
        const wave = Math.sin(f * 5 - t * 1.6 * h.sp + h.ph) * 0.5 + Math.sin(f * 2.2 - t * 0.9 * h.sp + h.ph * 1.7) * 0.5;
        const side = (wave * 0.5 * reach + (cx * nx + cy * ny) * 0.4 * reach) * g;
        const along = R + reach * f;
        const x = dx * along + nx * side, y = dy * along + ny * side;
        this.hairPos.set([px, py, 0, x, y, 0], k * 6); k++;
        px = x; py = y;
      }
    }
    this.hairs.geometry.attributes.position.needsUpdate = true;
    this.hairs.material.opacity = 0.25 + 0.1 * Math.sin(t * 2) + this.pop * 0.4;
    // motes drifting round
    for (let i = 0; i < MOTES; i++) { const m = this.mote[i]; m.a += m.w * dt; this.motePos.set([Math.cos(m.a) * R * m.r, Math.sin(m.a) * R * m.r, 0], i * 3); }
    this.motes.geometry.attributes.position.needsUpdate = true;
    this.motes.material.size = 0.25 + this.obj.radius * 0.03;
  }
}
