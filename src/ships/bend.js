// Lay a design along the path its nose has travelled, like a snake. Local space: forward -Z, right +X.
// A model point (x, y, z) becomes: the trail point at arc length z*scale.z behind the nose, offset sideways by x and up by y
// in that point's own frame (tangent, right, up). The result is converted back into the model's local space, so the design
// code writes bent coordinates as if nothing happened. `spin` rolls the body about its own centreline before the lay-out.
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const _p = new THREE.Vector3(), _t = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _qz = new THREE.Quaternion(), _z = new THREE.Vector3(0, 0, 1);

export class Bender {
  constructor() { this.trail = null; this.scale = new THREE.Vector3(1, 1, 1); this.inv = new THREE.Matrix4(); this.invQ = new THREE.Quaternion(); this.spin = 0; this.cs = 1; this.sn = 0; }
  /** trail: Trail in world space; scale: model group's world scale; inv: world -> model-group-parent matrix; invQ: its rotation; spin: roll */
  set(trail, scale, inv, invQ, spin = 0) {
    this.trail = trail; this.scale.copy(scale); this.inv.copy(inv); this.invQ.copy(invQ);
    this.spin = spin; this.cs = Math.cos(spin); this.sn = Math.sin(spin);
  }
  get active() { return !!this.trail; }
  /** world frame at model depth z: position and tangent, right, up */
  frame(z) {
    this.trail.sample(z * this.scale.z, _p, _t);
    _r.crossVectors(_t, UP); if (_r.lengthSq() < 1e-6) _r.set(1, 0, 0); _r.normalize();
    _u.crossVectors(_r, _t).normalize();
  }
  /** bend a point in place */
  point(p) {
    if (!this.active) return p;
    const x = (p.x * this.cs - p.y * this.sn) * this.scale.x, y = (p.x * this.sn + p.y * this.cs) * this.scale.y;
    this.frame(p.z);
    p.copy(_p).addScaledVector(_r, x).addScaledVector(_u, y).applyMatrix4(this.inv);
    p.x /= this.scale.x; p.y /= this.scale.y; p.z /= this.scale.z;
    return p;
  }
  xyz(x, y, z) { const v = new THREE.Vector3(x, y, z); this.point(v); return [v.x, v.y, v.z]; }
  /** place a rigid part whose straight-line position is (x, y, z): moves it onto the path and turns it to follow the tangent */
  place(obj, x, y, z) {
    if (!this.active) { obj.position.set(x, y, z); obj.rotation.set(0, 0, 0); return; }
    const v = obj.position.set(x, y, z); this.point(v);
    this.frame(z);
    _m.lookAt(new THREE.Vector3(), _t, _u);           // -Z along the tangent, +Y along the frame's up (world space)
    _q.setFromRotationMatrix(_m).premultiply(this.invQ);
    _qz.setFromAxisAngle(_z, this.spin);
    obj.quaternion.copy(_q).multiply(_qz);
  }
}
