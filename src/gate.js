// The gate: a small dark hole in each system that folds open onto the others. Arrivals emerge scattered around it.
// Visual: a black core, a thin bright rim, two tilted rings turning opposite ways, and motes spiralling in and vanishing.
import * as THREE from 'three';
import { COLORS } from './config.js';
import { glowSprite } from './materials.js';
import { rnd, TAU } from './utils.js';

const MOTES = 260, S = 12;   // S: overall scale; the gate must read from kilometres away

export class Gate {
  constructor(scene, def) {
    this.scene = scene;
    const g = new THREE.Group(); this.group = g;
    g.position.set(...def.pos); g.name = def.name; g.kind = 'site'; g.type = 'gate'; g.radius = 30 * S; g.home = false; g.t = 0;
    g.add(new THREE.Mesh(new THREE.SphereGeometry(14 * S, 32, 24), new THREE.MeshBasicMaterial({ color: 0x000000 })));
    // rim: a bright thin torus just outside the core, the "event horizon" edge
    this.rim = new THREE.Mesh(new THREE.TorusGeometry(15.2 * S, 0.35 * S, 8, 128), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x9f8cff).multiplyScalar(1.6), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    g.add(this.rim);
    const glow = glowSprite(0x9f8cff, 70 * S, 0.35); glow.material.fog = false; g.add(glow); this.glow = glow;
    const halo = glowSprite(COLORS.white, 34 * S, 0.25); halo.material.fog = false; g.add(halo); this.halo = halo;
    // rings
    this.rings = [[0.5, 0.2], [-0.6, 0.9]].map(([rx, ry], i) => {
      const r = new THREE.Mesh(new THREE.TorusGeometry((26 + i * 9) * S, 0.18 * S, 6, 160), new THREE.MeshBasicMaterial({ color: new THREE.Color(i ? COLORS.ice : 0x9f8cff).multiplyScalar(1.3), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      r.rotation.set(rx, ry, 0); r.w = i ? -0.25 : 0.35; g.add(r); return r;
    });
    // motes spiralling in
    this.pos = new Float32Array(MOTES * 3); this.motes = Array.from({ length: MOTES }, () => this.seed({}));
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); this.mgeo = mg;
    const pts = new THREE.Points(mg, new THREE.PointsMaterial({ color: new THREE.Color(COLORS.white).multiplyScalar(1.2), size: 1.1 * S, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    pts.frustumCulled = false; g.add(pts);
    // spire so it reads as a site
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -60 * S, 0), new THREE.Vector3(0, 60 * S, 0)]), new THREE.LineBasicMaterial({ color: 0x9f8cff, transparent: true, opacity: 0.3, fog: false })));
    scene.add(g);
  }
  seed(m) { m.a = rnd(0, TAU); m.r = rnd(40, 90) * S; m.y = rnd(-12, 12) * S; m.w = rnd(0.6, 1.4); m.v = rnd(8, 18) * S; return m; }
  /** a random arrival point 1000-5000 m out, roughly level with the gate */
  arrivalPoint() {
    const a = rnd(0, TAU), d = rnd(1000, 5000);
    return this.group.position.clone().add(new THREE.Vector3(Math.cos(a) * d, rnd(-0.15, 0.15) * d, Math.sin(a) * d));
  }
  dispose() { this.scene.remove(this.group); }
  update(dt) {
    const g = this.group; g.t += dt; const t = g.t;
    for (const r of this.rings) r.rotation.z += r.w * dt;
    this.rim.material.opacity = 0.7 + 0.25 * Math.sin(t * 2.1);
    this.glow.scale.setScalar((64 + 8 * Math.sin(t * 0.9)) * S); this.halo.scale.setScalar((30 + 4 * Math.sin(t * 1.7)) * S);
    for (let i = 0; i < MOTES; i++) {
      const m = this.motes[i];
      m.r -= m.v * dt * (1 + (90 * S - m.r) / (40 * S)); m.a += m.w * dt * (90 * S / Math.max(m.r, 12 * S)); m.y *= 1 - dt * 0.8;
      if (m.r < 15 * S) this.seed(m);
      this.pos.set([Math.cos(m.a) * m.r, m.y, Math.sin(m.a) * m.r], i * 3);
    }
    this.mgeo.attributes.position.needsUpdate = true;
  }
}
