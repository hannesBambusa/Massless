// Energy condensates: clumps of bound energy you can harvest. A soft particle cloud with a faint lattice inside.
import * as THREE from 'three';
import { COLORS, WORLD, ROCK } from './config.js';
import { faintEdgeMat } from './materials.js';
import { rnd, pick } from './utils.js';

function rockGeometry(r) {
  const g = new THREE.IcosahedronGeometry(r, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = rnd(0.75, 1.2);
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k);
  }
  p.needsUpdate = true; g.computeVertexNormals();
  return g;
}

export class Asteroids {
  /** centres: positions to scatter a cluster around (one per site) */
  constructor(scene, centres = [new THREE.Vector3()]) {
    this.group = new THREE.Group();
    this.list = [];
    const half = WORLD.clusterRadius, tints = [COLORS.ice, COLORS.gold, COLORS.sky, COLORS.amber, COLORS.white];
    let i = 0;
    for (const centre of centres) for (let n = 0; n < WORLD.asteroids; n++, i++) {
      const r = rnd(2, 14), geo = rockGeometry(r);
      const m = new THREE.Group();
      const tint = pick(tints);
      m.tint = tint;   // the cloud's energy colour: the lance, the siphon and the loot take it
      // cloud: points packed toward the centre
      const N = Math.round(60 + r * 12), cp = new Float32Array(N * 3), cc = new Float32Array(N * 3), col = new THREE.Color();
      for (let k = 0; k < N; k++) {
        const u = rnd(-1, 1), t = rnd(0, Math.PI * 2), sq = Math.sqrt(1 - u * u), rr = r * Math.pow(Math.random(), 0.6) * 1.15;
        cp.set([rr * sq * Math.cos(t), rr * sq * Math.sin(t), rr * u], k * 3);
        col.set(Math.random() < 0.25 ? COLORS.white : tint).multiplyScalar(rnd(0.5, 1.3)); cc.set([col.r, col.g, col.b], k * 3);
      }
      const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.BufferAttribute(cp, 3)); cg.setAttribute('color', new THREE.BufferAttribute(cc, 3));
      m.add(new THREE.Points(cg, new THREE.PointsMaterial({ size: 0.9, vertexColors: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })));
      m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 12), faintEdgeMat(tint, rnd(0.18, 0.35))));
      const core = new THREE.Mesh(new THREE.SphereGeometry(r * 0.28, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(tint).multiplyScalar(0.9), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.add(core);
      m.position.set(rnd(-half, half), rnd(-half * 0.4, half * 0.4), rnd(-half, half));
      if (m.position.length() < 60) m.position.setLength(80);   // keep the site beacon clear
      m.position.add(centre);
      m.rotation.set(rnd(0, 6), rnd(0, 6), rnd(0, 6));
      m.spin = new THREE.Vector3(rnd(-0.2, 0.2), rnd(-0.2, 0.2), rnd(-0.2, 0.2));
      m.radius = r;
      m.hpMax = m.hp = Math.round(r * ROCK.hpPerRadius); m.shiver = 0; m.dead = false;
      m.hit = (dmg, lock) => { m.hp = Math.max(0, m.hp - dmg); m.shiver = Math.max(m.shiver, lock); };
      m.name = `Condensate ${String.fromCharCode(65 + (i % 26))}-${Math.floor(i / 26) + 1}`;
      m.kind = 'cloud';
      this.group.add(m); this.list.push(m);
    }
    scene.add(this.group);
  }

  /** onDeath(rock) is called once when a rock reaches 0 hp; the rock is removed here */
  update(dt, onDeath) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const m = this.list[i];
      m.rotation.x += m.spin.x * dt; m.rotation.y += m.spin.y * dt; m.rotation.z += m.spin.z * dt;
      if (m.hp <= 0 && !m.dead) { m.dead = true; this.group.remove(m); this.list.splice(i, 1); if (onDeath) onDeath(m); continue; }
      // shiver under the lance: jitter the whole rock and flicker its edges; fades once the beam lets go
      // drained clouds thin out: the particle cloud and lattice fade with hp, the core shrinks
      const hpF = m.hp / m.hpMax;
      m.children[0].material.opacity = 0.25 + 0.6 * hpF;
      m.children[2].scale.setScalar(0.4 + 0.6 * hpF);
      if (m.shiver > 0) {
        const s = m.shiver, k = 1 + (Math.random() - 0.5) * 0.12 * s;
        m.scale.set(k, 1 + (Math.random() - 0.5) * 0.12 * s, k);
        m.children[1].material.opacity = Math.min(1, 0.3 + s * 0.6 * Math.random());
        m.shiver = Math.max(0, m.shiver - dt * 1.5);
      } else if (m.scale.x !== 1) m.scale.set(1, 1, 1);
    }
  }
}
