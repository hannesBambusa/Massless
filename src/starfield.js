// Three parallax shells of stars centred on the camera plus a few nebula sprites far out.
// Shells move with the camera, so the sky never runs out; the ship's motion is felt through the asteroids.
import * as THREE from 'three';
import { COLORS, WORLD } from './config.js';
import { glowSprite } from './materials.js';
import { rnd, TAU } from './utils.js';

export class Starfield {
  constructor(scene) {
    this.group = new THREE.Group();
    this.layers = [];
    this._off = new THREE.Vector3();
    WORLD.stars.forEach((count, i) => {
      const R = WORLD.starRadius[i], pos = new Float32Array(count * 3), col = new Float32Array(count * 3), tint = new THREE.Color();
      for (let n = 0; n < count; n++) {
        // uniform on a sphere shell
        const u = rnd(-1, 1), t = rnd(0, TAU), s = Math.sqrt(1 - u * u), r = R * rnd(0.85, 1);
        pos.set([r * s * Math.cos(t), r * s * Math.sin(t), r * u], n * 3);
        const roll = Math.random();
        tint.set(roll < 0.35 ? COLORS.gold : roll < 0.5 ? COLORS.amber : roll < 0.65 ? COLORS.ice : COLORS.white).multiplyScalar(rnd(0.3, 1.1));
        col.set([tint.r, tint.g, tint.b], n * 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.2 + i * 0.6, vertexColors: true, sizeAttenuation: false, transparent: true, opacity: 0.9, depthWrite: false }));
      pts.parallax = 0.15 + i * 0.25;   // how much this shell leans toward the ship (0 = fixed sky)
      pts.radius = R;
      this.group.add(pts); this.layers.push(pts);
    });
    // nebulas: big soft sprites on the far shell
    const neb = [[COLORS.nebula, 0.30], [COLORS.blue, 0.26], [COLORS.deep, 0.5], [COLORS.sky, 0.14], [COLORS.nebula, 0.22], [COLORS.violet, 0.06]];
    this.nebulas = neb.map(([c, a]) => {
      const s = glowSprite(c, rnd(600, 1300), a);
      const u = rnd(-1, 1), t = rnd(0, TAU), q = Math.sqrt(1 - u * u), r = WORLD.starRadius[0] * 1.1;
      s.position.set(r * q * Math.cos(t), r * q * Math.sin(t), r * u);
      this.group.add(s); return s;
    });
    scene.add(this.group);
  }

  /** shells sit on the camera, offset a little toward the ship by their parallax so near stars slide past far ones; the offset is capped so a far zoom never shows a shell as a ball */
  update(cameraPos, shipPos) {
    for (const l of this.layers) {
      const off = this._off.copy(shipPos).sub(cameraPos).multiplyScalar(l.parallax);
      const cap = l.radius * 0.3; if (off.length() > cap) off.setLength(cap);
      l.position.copy(cameraPos).add(off);
    }
    for (const n of this.nebulas) n.position.add(cameraPos.clone().sub(n.userData.last || cameraPos)), n.userData.last = cameraPos.clone();
  }
}
