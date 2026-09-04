// Selected object: a camera-facing bracket ring around it in the scene, and a small info panel in the DOM.
import * as THREE from 'three';
import { COLORS } from './config.js';
import { edgeMat } from './materials.js';

export class Selection {
  constructor(scene, camera) {
    this.camera = camera;
    this.obj = null;
    const pts = [];
    for (let i = 0; i <= 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; pts.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0)); }
    this.ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts.slice(0, 4)), edgeMat(COLORS.gold, 1.3));
    this.ring.visible = false;
    scene.add(this.ring);
    this.t = 0;
    this.listeners = [];
  }
  onChange(fn) { this.listeners.push(fn); }
  set(obj) { if (this.obj === obj) return; this.obj = obj; for (const fn of this.listeners) fn(obj); }
  clear() { this.set(null); }
  update(dt) {
    this.ring.visible = !!this.obj;
    if (!this.obj) return;
    this.t += dt;
    this.ring.position.copy(this.obj.position);
    this.ring.quaternion.copy(this.camera.quaternion);
    this.ring.rotation.z += this.t * 0.6;
    this.ring.scale.setScalar((this.obj.radius + 3) * 1.4);
  }
}
