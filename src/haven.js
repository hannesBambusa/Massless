// The Haven: the player's home. A private pocket in space wrapped in a large translucent energy bubble.
// Inside: a hearth (a warm core with a slow halo), a hexagonal lattice floor, and calm motes rising.
// One per player; in single-player it lives in the starting system and only you can warp to it.
import * as THREE from 'three';
import { COLORS } from './config.js';
import { glowSprite, glowLineMat } from './materials.js';
import { Shield } from './shield.js';
import { rnd, TAU } from './utils.js';

const R = 420;            // bubble radius
const MOTES = 320;

export class Haven {
  constructor(scene, def) {
    this.scene = scene;
    const g = new THREE.Group(); this.group = g; g.position.set(...def.pos);
    g.name = def.name; g.kind = 'site'; g.type = 'haven'; g.radius = R; g.home = true; g.private = true; g.t = 0;
    // bubble: the fresnel shell, faint and lavender, rippling slowly
    this.shell = new Shield(R); this.shell.uniforms.color.value.set(COLORS.lav); g.add(this.shell.mesh);
    this.shell.mesh.material.side = THREE.DoubleSide;
    // hearth
    this.core = new THREE.Mesh(new THREE.SphereGeometry(7, 24, 18), new THREE.MeshBasicMaterial({ color: new THREE.Color(COLORS.white).multiplyScalar(0.9) })); g.add(this.core);
    this.coreGlow = [glowSprite(COLORS.white, 30, 0.5), glowSprite(COLORS.lav, 90, 0.3), glowSprite(COLORS.gold, 200, 0.1)]; for (const s of this.coreGlow) g.add(s);
    // lattice floor: a disc of hexagons below the hearth, fading outward
    const hex = [], hexCol = [], size = 22, rows = 9, base = new THREE.Color(COLORS.lav);
    for (let q = -rows; q <= rows; q++) for (let r = -rows; r <= rows; r++) {
      const x = size * 1.5 * q, z = size * Math.sqrt(3) * (r + q / 2), d = Math.hypot(x, z); if (d > R * 0.72) continue;
      const fade = Math.pow(1 - d / (R * 0.72), 1.2);
      for (let k = 0; k < 6; k++) { const a0 = k / 6 * TAU + TAU / 12, a1 = a0 + TAU / 6; hex.push(x + Math.cos(a0) * size * 0.95, -120, z + Math.sin(a0) * size * 0.95, x + Math.cos(a1) * size * 0.95, -120, z + Math.sin(a1) * size * 0.95); hexCol.push(base.r * fade, base.g * fade, base.b * fade, base.r * fade, base.g * fade, base.b * fade); }
    }
    const fg = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(hex, 3)).setAttribute('color', new THREE.Float32BufferAttribute(hexCol, 3));
    this.floor = new THREE.LineSegments(fg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })); this.floor.frustumCulled = false; g.add(this.floor);
    // motes rising slowly through the bubble
    this.pos = new Float32Array(MOTES * 3); this.motes = Array.from({ length: MOTES }, () => this.seed({}, true));
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); this.mgeo = mg;
    const pts = new THREE.Points(mg, new THREE.PointsMaterial({ color: new THREE.Color(COLORS.ice).multiplyScalar(1.1), size: 1.6, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false })); pts.frustumCulled = false; g.add(pts);
    // beacon spire so it reads as a site from afar
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -R, 0), new THREE.Vector3(0, R, 0)]), glowLineMat(COLORS.lav, 1, 0.18)));
    scene.add(g);
  }
  seed(m, anywhere = false) { const a = rnd(0, TAU), r = Math.sqrt(Math.random()) * R * 0.85; m.x = Math.cos(a) * r; m.z = Math.sin(a) * r; m.y = anywhere ? rnd(-R * 0.8, R * 0.8) : -R * 0.8; m.v = rnd(2, 6); m.ph = rnd(0, TAU); return m; }
  /** a spot inside the bubble to start or re-form at */
  spawnPoint() { return this.group.position.clone().add(new THREE.Vector3(rnd(-60, 60), rnd(-10, 30), rnd(60, 120))); }
  dispose() { this.scene.remove(this.group); }
  update(dt) {
    const g = this.group; g.t += dt; const t = g.t;
    this.shell.update(dt, 0, 1);
    this.core.scale.setScalar(1 + 0.05 * Math.sin(t * 1.3));
    this.coreGlow[0].scale.setScalar(30 + 3 * Math.sin(t * 1.3)); this.coreGlow[1].scale.setScalar(90 + 8 * Math.sin(t * 0.7)); this.coreGlow[2].material.opacity = 0.08 + 0.04 * Math.sin(t * 0.4);
    this.floor.position.y = Math.sin(t * 0.3) * 4;
    for (let i = 0; i < MOTES; i++) {
      const m = this.motes[i]; m.y += m.v * dt; m.x += Math.sin(t * 0.5 + m.ph) * 1.5 * dt; m.z += Math.cos(t * 0.4 + m.ph) * 1.5 * dt;
      if (m.y > R * 0.8 || Math.hypot(m.x, m.y, m.z) > R * 0.92) this.seed(m);
      this.pos.set([m.x, m.y, m.z], i * 3);
    }
    this.mgeo.attributes.position.needsUpdate = true;
  }
}
