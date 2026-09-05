// Motes released when something is unbound: they drift out, then home in on the ship and become scrap on arrival.
import * as THREE from 'three';
import { COLORS } from './config.js';
import { rnd, damp } from './utils.js';

const MAX = 600;

export class Loot {
  constructor(scene, ship, onCollect) {
    this.ship = ship; this.onCollect = onCollect;
    this.pos = new Float32Array(MAX * 3); this.col = new Float32Array(MAX * 3);
    this.items = [];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.geo = geo;
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.9, vertexColors: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.points.frustumCulled = false;
    scene.add(this.points);
    this._d = new THREE.Vector3();
  }
  /** release n motes at p, each worth `value` scrap */
  /** key: which energy this is (inventory slot) */
  burst(p, n, value, color = COLORS.gold, key = 'sol', harvested = false) {
    const c = new THREE.Color(color);
    for (let i = 0; i < n && this.items.length < MAX; i++) {
      const v = new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(4, 14));
      this.items.push({ p: p.clone(), v, age: 0, value, key, harvested, c: c.clone().multiplyScalar(rnd(0.8, 1.6)) });
    }
  }
  /** floating origin */
  shift(d) { for (const it of this.items) it.p.sub(d); }
  update(dt) {
    const ship = this.ship.position;
    const gained = {};
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]; it.age += dt;
      if (it.age > 0.5) {   // after the burst, home in with growing pull
        this._d.copy(ship).sub(it.p); const d = this._d.length(); this._d.normalize();
        it.v.addScaledVector(this._d, (30 + it.age * 40) * dt);
        it.v.multiplyScalar(Math.max(0, 1 - 1.5 * dt));
        if (d < 3 + this.ship.speed * 0.05) { const k = it.key + (it.harvested ? ':h' : ''); gained[k] = (gained[k] || 0) + it.value; this.items.splice(i, 1); continue; }
      }
      it.p.addScaledVector(it.v, dt);
    }
    for (const k in gained) { const [key, h] = k.split(':'); this.onCollect(key, gained[k], h === 'h'); }
    for (let i = 0; i < MAX; i++) {
      const it = this.items[i];
      if (it) { this.pos.set([it.p.x, it.p.y, it.p.z], i * 3); this.col.set([it.c.r, it.c.g, it.c.b], i * 3); }
      else this.pos.set([0, -1e6, 0], i * 3);
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.color.needsUpdate = true;
  }
}
