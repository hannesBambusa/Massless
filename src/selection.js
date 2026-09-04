// Selected object: a living, glowing halo around it, camera-facing.
//   - a bright breathing ring with a soft glow band behind it
//   - a slow-turning segmented outer ring, and a counter-turning inner one
//   - four bright nodes on the ring with short trails, plus motes drifting round
//   - two pulses travelling round the ring
//   - on select: a burst ring expanding outward and the halo popping
import * as THREE from 'three';
import { COLORS } from './config.js';
import { glowSprite } from './materials.js';
import { rnd, TAU } from './utils.js';

const HAIRS = 26, SEG = 7, MOTES = 14, RING = 96, SEGS = 18;
const GOLD = new THREE.Color(COLORS.gold), WHITE = new THREE.Color(COLORS.white);

const lineMat = (col, op, mult = 1.6) => new THREE.LineBasicMaterial({ color: col.clone().multiplyScalar(mult), transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false });

export class Selection {
  constructor(scene, camera) {
    this.camera = camera;
    this.obj = null;
    this.group = new THREE.Group(); this.group.visible = false; scene.add(this.group);
    const buf = (n) => { const pos = new Float32Array(n * 3), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); return { pos, g }; };
    // main ring: three strokes at slightly different radii read as one thick glowing band
    this.rings = [0.985, 1, 1.015].map((k, i) => { const b = buf(RING + 1); const l = new THREE.Line(b.g, lineMat(i === 1 ? WHITE : GOLD, i === 1 ? 0.9 : 0.5, i === 1 ? 1.2 : 1.8)); l.k = k; l.pos = b.pos; l.frustumCulled = false; this.group.add(l); return l; });
    // soft glow band behind the ring: a ring of sprites
    this.band = []; for (let i = 0; i < 12; i++) { const s = glowSprite(COLORS.gold, 1, 0.18); s.a = i / 12 * TAU; this.group.add(s); this.band.push(s); }
    // segmented outer ring (turns) and dashed inner ring (counter-turns)
    const ob = buf(SEGS * 2); this.outer = new THREE.LineSegments(ob.g, lineMat(GOLD, 0.7, 1.5)); this.outer.pos = ob.pos; this.outer.frustumCulled = false; this.group.add(this.outer);
    const ib = buf(SEGS * 4); this.inner = new THREE.LineSegments(ib.g, lineMat(WHITE, 0.5, 1.1)); this.inner.pos = ib.pos; this.inner.frustumCulled = false; this.group.add(this.inner);
    // hairs
    const hb = buf(HAIRS * SEG * 2); this.hairs = new THREE.LineSegments(hb.g, lineMat(GOLD, 0.55, 1.6)); this.hairs.pos = hb.pos; this.hairs.frustumCulled = false; this.group.add(this.hairs);
    this.hair = Array.from({ length: HAIRS }, (_, i) => ({ a: i / HAIRS * TAU + rnd(-0.05, 0.05), ph: rnd(0, TAU), sp: rnd(0.5, 1.1), len: rnd(0.18, 0.4) }));
    // nodes: four bright sprites on the ring with short trails
    this.nodes = [0, 1, 2, 3].map((i) => { const s = glowSprite(COLORS.white, 1, 0.95); s.a = i * TAU / 4; this.group.add(s); return s; });
    const tb = buf(4 * 6 * 2); this.trails = new THREE.LineSegments(tb.g, lineMat(WHITE, 0.6, 1.2)); this.trails.pos = tb.pos; this.trails.frustumCulled = false; this.group.add(this.trails);
    // pulses travelling round the ring
    this.pulses = [0, 1].map((i) => { const s = glowSprite(COLORS.gold, 1, 0.9); s.a = i * Math.PI; this.group.add(s); return s; });
    // motes
    const mb = buf(MOTES); this.motes = new THREE.Points(mb.g, new THREE.PointsMaterial({ color: WHITE.clone().multiplyScalar(1.3), size: 0.5, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); this.motes.pos = mb.pos; this.motes.frustumCulled = false; this.group.add(this.motes);
    this.mote = Array.from({ length: MOTES }, () => ({ a: rnd(0, TAU), w: rnd(0.25, 0.7) * (Math.random() < 0.5 ? 1 : -1), r: rnd(1.1, 1.5), bob: rnd(0, TAU) }));
    // burst ring on select
    const bb = buf(RING + 1); this.burstRing = new THREE.Line(bb.g, lineMat(WHITE, 0, 1.4)); this.burstRing.pos = bb.pos; this.burstRing.frustumCulled = false; this.group.add(this.burstRing);
    this.centre = glowSprite(COLORS.gold, 1, 0.0); this.group.add(this.centre);
    this.t = 0; this.pop = 0;
    this.listeners = [];
  }
  onChange(fn) { this.listeners.push(fn); }
  set(obj) { if (this.obj === obj) return; this.obj = obj; this.pop = 1; for (const fn of this.listeners) fn(obj); }
  clear() { this.set(null); }

  update(dt) {
    this.group.visible = !!this.obj;
    if (!this.obj) return;
    this.t += dt; this.pop = Math.max(0, this.pop - dt * 1.6);
    const t = this.t, pop = this.pop, R = (this.obj.radius + 3) * (1 + pop * pop * 0.5);
    const hostile = this.obj.kind === 'mob';
    this.group.position.copy(this.obj.position);
    this.group.quaternion.copy(this.camera.quaternion);
    const breathe = 1 + 0.02 * Math.sin(t * 1.4);
    // rings
    for (const l of this.rings) {
      for (let i = 0; i <= RING; i++) { const a = i / RING * TAU, rr = R * l.k * breathe * (1 + 0.01 * Math.sin(a * 5 + t * 1.6)); l.pos.set([Math.cos(a) * rr, Math.sin(a) * rr, 0], i * 3); }
      l.geometry.attributes.position.needsUpdate = true;
    }
    this.rings[1].material.opacity = 0.75 + 0.2 * Math.sin(t * 2.2) + pop * 0.3;
    for (const s of this.band) { s.position.set(Math.cos(s.a) * R, Math.sin(s.a) * R, -0.01); s.scale.setScalar(R * 0.55); s.material.opacity = 0.14 + 0.06 * Math.sin(t * 2 + s.a * 2) + pop * 0.3; }
    // outer segmented ring turns, inner dashed counter-turns
    const oa = t * 0.35, ir = R * 0.86, oR = R * 1.14 * (1 + pop * 0.3);
    for (let i = 0; i < SEGS; i++) {
      const a0 = oa + i / SEGS * TAU, a1 = a0 + TAU / SEGS * 0.55;
      this.outer.pos.set([Math.cos(a0) * oR, Math.sin(a0) * oR, 0, Math.cos(a1) * oR, Math.sin(a1) * oR, 0], i * 6);
      const b0 = -t * 0.6 + i / SEGS * TAU, b1 = b0 + TAU / SEGS * 0.3;
      this.inner.pos.set([Math.cos(b0) * ir, Math.sin(b0) * ir, 0, Math.cos(b1) * ir, Math.sin(b1) * ir, 0], i * 12);
      const c0 = b1 + TAU / SEGS * 0.15, c1 = c0 + TAU / SEGS * 0.12;
      this.inner.pos.set([Math.cos(c0) * ir, Math.sin(c0) * ir, 0, Math.cos(c1) * ir, Math.sin(c1) * ir, 0], i * 12 + 6);
    }
    this.outer.geometry.attributes.position.needsUpdate = true; this.inner.geometry.attributes.position.needsUpdate = true;
    // hairs (disabled)
    const cx = 0, cy = 0;
    let k = 0;
    for (const h of []) {
      const dx = Math.cos(h.a), dy = Math.sin(h.a), nx = -dy, ny = dx, reach = R * h.len * (1 + pop * 1.2);
      let px = dx * R, py = dy * R;
      for (let i = 1; i <= SEG; i++) {
        const f = i / SEG, g = Math.pow(f, 1.6);
        const wave = Math.sin(f * 5 - t * 1.6 * h.sp + h.ph) * 0.5 + Math.sin(f * 2.2 - t * 0.9 * h.sp + h.ph * 1.7) * 0.5;
        const side = (wave * 0.55 * reach + (cx * nx + cy * ny) * 0.45 * reach) * g, along = R + reach * f;
        const x = dx * along + nx * side, y = dy * along + ny * side;
        this.hairPosSet(k, px, py, x, y); k++; px = x; py = y;
      }
    }
    this.hairs.geometry.attributes.position.needsUpdate = true;
    this.hairs.material.opacity = 0;   // hairs off: the halo carries it without them
    // nodes with trails, spinning slowly; hostile targets spin faster
    const spin = t * (hostile ? 0.9 : 0.45);
    this.nodes.forEach((n, i) => {
      const a = n.a + spin; n.position.set(Math.cos(a) * R, Math.sin(a) * R, 0.01); n.scale.setScalar(R * 0.16 + Math.sin(t * 5 + i) * R * 0.02);
      for (let j = 0; j < 6; j++) { const a0 = a - j * 0.05, a1 = a - (j + 1) * 0.05; this.trails.pos.set([Math.cos(a0) * R, Math.sin(a0) * R, 0, Math.cos(a1) * R, Math.sin(a1) * R, 0], (i * 6 + j) * 6); }
    });
    this.trails.geometry.attributes.position.needsUpdate = true;
    // pulses running round the ring
    this.pulses.forEach((p, i) => { const a = p.a + t * 2.4; p.position.set(Math.cos(a) * R, Math.sin(a) * R, 0.02); p.scale.setScalar(R * 0.22); p.material.opacity = 0.6 + 0.3 * Math.sin(t * 9 + i); });
    // motes
    for (let i = 0; i < MOTES; i++) { const m = this.mote[i]; m.a += m.w * dt; const rr = R * m.r * (1 + 0.05 * Math.sin(t * 1.3 + m.bob)); this.motes.pos.set([Math.cos(m.a) * rr, Math.sin(m.a) * rr, Math.sin(t + m.bob) * R * 0.05], i * 3); }
    this.motes.geometry.attributes.position.needsUpdate = true; this.motes.material.size = 0.3 + this.obj.radius * 0.04;
    // burst on select
    const bR = R * (1 + (1 - pop) * 2.2);
    for (let i = 0; i <= RING; i++) { const a = i / RING * TAU; this.burstRing.pos.set([Math.cos(a) * bR, Math.sin(a) * bR, 0], i * 3); }
    this.burstRing.geometry.attributes.position.needsUpdate = true; this.burstRing.material.opacity = pop * pop * 0.9;
    this.centre.scale.setScalar(R * 1.6); this.centre.material.opacity = pop * 0.5;
    // hostile tint: red-pink instead of gold
    const col = hostile ? 0xff5f8a : COLORS.gold;
    for (const s of [...this.band, ...this.pulses, this.centre]) s.material.color.set(col);
    this.rings[0].material.color.set(col).multiplyScalar(1.8); this.rings[2].material.color.set(col).multiplyScalar(1.8); this.outer.material.color.set(col).multiplyScalar(1.5); this.hairs.material.color.set(col).multiplyScalar(1.6);
  }
  hairPosSet(k, x0, y0, x1, y1) { this.hairs.pos.set([x0, y0, 0, x1, y1, 0], k * 6); }
}
