// Sites: named places across the system you can warp between. Each is a glowing beacon structure with a rock cluster around it.
import * as THREE from 'three';
import { COLORS } from './config.js';
import { glowSprite, faintEdgeMat } from './materials.js';
import { TAU, rnd } from './utils.js';

export const SITES = [
  // type: harvest sites grow condensates on their streams; combat sites are torn open by a rift that wisps pour out of
  { name: 'Ash Reach', pos: [0, 0, 0], color: COLORS.cyan, type: 'harvest' },
  { name: 'Cinder Belt', pos: [12600, 360, -5400], color: COLORS.amber, type: 'harvest' },
  { name: 'Vell Anchor', pos: [-10800, -600, -11700], color: COLORS.sky, type: 'combat' },
  { name: 'The Hollow', pos: [-15600, 900, 7200], color: COLORS.violet, type: 'combat' },
  { name: 'Sable Gate', pos: [7800, -780, 16800], color: COLORS.gold, type: 'combat' },
  { name: 'Quill Drift', pos: [23400, 1200, 6600], color: COLORS.ice, type: 'harvest' },
  { name: 'Far Lantern', pos: [90000, 3000, -110000], color: COLORS.magenta, type: 'harvest' },   // ~57 AU out: a long warp
];

const NEW_NAMES = ['Kessel Scar', 'Vantage Tear', 'Hollow Brand', 'Umber Rift', 'Nether Seam', 'Pale Fracture', 'Grave Anchor', 'Sunder Reach', 'Ashen Gate', 'Rimewound'];
const NEW_COLORS = [COLORS.magenta, COLORS.red, COLORS.violet, COLORS.amber];

export class Sites {
  constructor(scene) {
    this.group = new THREE.Group();
    this.list = SITES.map((s) => this.build(s));
    scene.add(this.group);
  }

  build(def) {
    const g = new THREE.Group();
    g.position.set(...def.pos);
    g.name = def.name; g.kind = 'site'; g.radius = 18; g.type = def.type;
    // beacon: a long glint visible from across the system (no fog), plus a local structure of rings
    // the far glint lives at scene level and is re-projected each frame, so it shows from any distance regardless of the camera's far plane
    const far = glowSprite(def.color, 60, 0.9); far.material.fog = false; this.group.add(far);
    const near = glowSprite(COLORS.white, 14, 0.6); g.add(near);
    const ringMat = faintEdgeMat(def.color, 0.6);
    for (let i = 0; i < 3; i++) {
      const pts = []; for (let k = 0; k <= 64; k++) { const a = k / 64 * TAU; pts.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0)); }
      const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), ringMat);
      ring.scale.setScalar(12 + i * 5); ring.rotation.set(i * 1.1, i * 0.7, 0); ring.spin = 0.15 + i * 0.1;
      g.add(ring);
    }
    // spire: vertical line
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -40, 0), new THREE.Vector3(0, 40, 0)]), faintEdgeMat(def.color, 0.35)));
    g.far = far; g.rings = g.children.filter((c) => c.spin);
    this.group.add(g);
    return g;
  }

  /** a new combat site somewhere out in the system, well away from every existing one */
  spawnCombat() {
    const used = new Set(this.list.map((s) => s.name));
    const name = NEW_NAMES.find((n) => !used.has(n)) || `Tear ${this.list.length}`;
    let pos;
    for (let tries = 0; tries < 40; tries++) {
      pos = [rnd(-30000, 30000), rnd(-1500, 1500), rnd(-30000, 30000)];
      const p = new THREE.Vector3(...pos);
      if (this.list.every((s) => s.position.distanceTo(p) > 6000)) break;
    }
    const g = this.build({ name, pos, color: NEW_COLORS[this.list.length % NEW_COLORS.length], type: 'combat' });
    this.list.push(g);
    return g;
  }

  update(dt, camPos) {
    for (const s of this.list) {
      for (const r of s.rings) { r.rotation.z += r.spin * dt; r.rotation.x += r.spin * 0.3 * dt; }
      // far glint grows with distance so it stays a visible point on the horizon
      const d = s.position.distanceTo(camPos);
      const hold = Math.min(d, 2500);   // sit on the line to the site, never further than the visible range
      s.far.position.copy(s.position).sub(camPos).normalize().multiplyScalar(hold).add(camPos);
      s.far.scale.setScalar(hold * 0.018 + 6);
      s.far.material.opacity = 0.9 * Math.min(1, Math.max(0, (d - 120) / 300));   // the glint is for far away; up close the rings and the near glow carry it
    }
  }
}
