// Bend a design along an arc so its whole length lies on the orbit circle.
// Local space: forward -Z, right +X. The arc's centre sits at x = side / k, where k = curvature (1 / radius in local units).
// A point at (x, y, z) keeps its height y, its distance from the centre (r = 1/k - side*x), and moves to angle z*k around the centre.
import * as THREE from 'three';

export class Bender {
  constructor() { this.k = 0; this.side = 1; this.spin = 0; this.cs = 1; this.sn = 0; }
  /** curvature k blends with weight w: w = 0 is straight, w = 1 is the full circle of radius R (local units). spin: roll about the centreline, applied before the bend */
  set(R, side, w, spin = 0) { this.k = R > 0 ? w / R : 0; this.side = side >= 0 ? 1 : -1; this.spin = spin; this.cs = Math.cos(spin); this.sn = Math.sin(spin); }
  get active() { return this.k > 1e-5 || this.spin !== 0; }
  /** bend a point in place */
  point(p) {
    if (!this.active) return p;
    const x = p.x * this.cs - p.y * this.sn, y = p.x * this.sn + p.y * this.cs;   // roll about the straight axis first
    p.x = x; p.y = y;
    if (this.k < 1e-5) return p;
    const k = this.k, s = this.side, th = p.z * k, r = 1 / k - s * x;
    p.x = s / k - s * r * Math.cos(th);
    p.z = r * Math.sin(th);
    return p;
  }
  /** bend raw xyz, returns [x, y, z] */
  xyz(x, y, z) {
    if (!this.active) return [x, y, z];
    const rx = x * this.cs - y * this.sn, ry = x * this.sn + y * this.cs;
    if (this.k < 1e-5) return [rx, ry, z];
    const k = this.k, s = this.side, th = z * k, r = 1 / k - s * rx;
    return [s / k - s * r * Math.cos(th), ry, r * Math.sin(th)];
  }
  /** place a rigid part whose straight-line position is (x, y, z): moves it onto the arc and turns it to follow the tangent */
  place(obj, x, y, z) {
    const [bx, by, bz] = this.xyz(x, y, z);
    obj.position.set(bx, by, bz);
    obj.rotation.set(0, this.k > 1e-5 ? this.side * z * this.k : 0, this.spin, 'YXZ');   // follow the tangent, then roll with the spin
  }
}
