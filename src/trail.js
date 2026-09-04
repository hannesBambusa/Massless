// The path the ship's nose has travelled, as a polyline with cumulative arc length. The body is laid along it (see bend.js).
import * as THREE from 'three';

const MIN_STEP = 0.35;      // world units between stored points
const MAX_LEN = 220;        // arc length kept

export class Trail {
  constructor() { this.pts = []; this.len = []; this.total = 0; this._d = new THREE.Vector3(); }
  /** call every frame with the nose position and the heading; only stores a point once the ship has moved MIN_STEP */
  push(pos, heading) {
    const last = this.pts[0];
    if (!last) { this.pts.unshift({ p: pos.clone(), t: heading.clone() }); this.len.unshift(0); return; }
    const d = pos.distanceTo(last.p);
    if (d < MIN_STEP) { last.t.copy(heading); return; }   // standing still or creeping: the head just turns in place
    const t = this._d.copy(pos).sub(last.p).normalize();
    last.t.copy(t);                                   // the previous point's tangent now points along the segment to the new head
    this.pts.unshift({ p: pos.clone(), t: heading.clone() });
    for (let i = 0; i < this.len.length; i++) this.len[i] += d;
    this.len.unshift(0);
    while (this.len[this.len.length - 1] > MAX_LEN && this.pts.length > 2) { this.pts.pop(); this.len.pop(); }
  }
  /** position and tangent at arc length s behind the head (s < 0 extrapolates ahead along the heading) */
  sample(s, outP, outT) {
    const head = this.pts[0];
    if (!head) { outP.set(0, 0, 0); outT.set(0, 0, -1); return; }
    if (s <= 0) { outT.copy(head.t); outP.copy(head.p).addScaledVector(head.t, -s); return; }
    const n = this.pts.length;
    for (let i = 1; i < n; i++) {
      if (this.len[i] >= s) {
        const a = this.pts[i - 1], b = this.pts[i], f = (s - this.len[i - 1]) / Math.max(1e-6, this.len[i] - this.len[i - 1]);
        outP.copy(a.p).lerp(b.p, f);
        outT.copy(a.t).lerp(b.t, f).normalize();
        return;
      }
    }
    const tail = this.pts[n - 1];   // beyond the stored path: continue straight
    outT.copy(tail.t); outP.copy(tail.p).addScaledVector(tail.t, -(s - this.len[n - 1]));
  }
  reset(pos, heading) { this.pts = [{ p: pos.clone(), t: heading.clone() }]; this.len = [0]; }
}
