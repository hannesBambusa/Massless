// Energy condensates: clumps of bound energy you can harvest. A soft particle cloud with a faint lattice inside.
import * as THREE from 'three';
import { COLORS, WORLD, ROCK, ENERGY } from './config.js';
import { faintEdgeMat } from './materials.js';
import { rnd, pick, TAU } from './utils.js';

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
  /** sites: the site groups (position + type); streams: for anchoring harvest-site condensates */
  constructor(scene, sites, streams) {
    this.group = new THREE.Group();
    this.list = [];
    this.tethers = new THREE.Group(); scene.add(this.tethers);
    for (const site of sites) this.populate(site, streams);
    scene.add(this.group);
    this._tmp = new THREE.Vector3();
  }

  /** grow this site's condensates */
  populate(site, streams) {
    const half = WORLD.clusterRadius, kinds = ENERGY.filter((e) => e.key !== 'ash');
    for (let n = 0, count = site.type === 'combat' ? WORLD.asteroidsCombat : WORLD.asteroids, i = this.list.length; n < count; n++, i++) {
      const centre = site.position;
      const r = rnd(2, 14), geo = rockGeometry(r);
      const m = new THREE.Group();
      const energy = Math.random() < 0.08 ? kinds[4] : pick(kinds.slice(0, 4));   // lumen is rare
      const tint = energy.color;
      m.tint = tint; m.energy = energy;   // the cloud's energy: colours the lance, the siphon and the loot, and names what you collect
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
      // harvest sites: grow off a stream, a short way from it, and remember the anchor point for the tether
      const anchor = site.type === 'harvest' && streams ? streams.randomPointNear(centre, half) : null;
      if (anchor) {
        m.position.set(rnd(-1, 1), rnd(-0.6, 0.6), rnd(-1, 1)).normalize().multiplyScalar(rnd(28, 70)).add(anchor);
        m.anchor = anchor;
      } else {
        m.position.set(rnd(-half, half), rnd(-half * 0.4, half * 0.4), rnd(-half, half));
        if (m.position.length() < 60) m.position.setLength(80);   // keep the site beacon clear
        m.position.add(centre);
      }
      if (m.position.distanceTo(centre) < 70) m.position.sub(centre).setLength(90).add(centre);
      m.rotation.set(rnd(0, 6), rnd(0, 6), rnd(0, 6));
      m.spin = new THREE.Vector3(rnd(-0.2, 0.2), rnd(-0.2, 0.2), rnd(-0.2, 0.2));
      m.radius = r;
      m.hpMax = m.hp = Math.round(r * ROCK.hpPerRadius); m.shiver = 0; m.dead = false;
      m.hit = (dmg, lock) => { m.hp = Math.max(0, m.hp - dmg); m.shiver = Math.max(m.shiver, lock); };
      m.name = `${energy.name} ${String.fromCharCode(65 + (i % 26))}-${Math.floor(i / 26) + 1}`;
      m.kind = 'cloud';
      this.group.add(m); this.list.push(m);
      if (m.anchor) this.tether(m, tint);
    }
  }

  /** an arcing line from the stream anchor to the cloud, sagging a little, flickering: the cloud grows off the stream */
  tether(m, tint) {
    const N = 12, pos = new Float32Array((N + 1) * 3);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: new THREE.Color(tint).multiplyScalar(1.2), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    line.frustumCulled = false;
    const mid = m.anchor.clone().lerp(m.position, 0.5).add(new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(6, 14)));
    m.tether = { line, pos, N, mid, ph: rnd(0, TAU), curve: new THREE.QuadraticBezierCurve3(m.anchor, mid, m.position) };
    this.tethers.add(line);
  }

  /** onDeath(rock) is called once when a rock reaches 0 hp; the rock is removed here */
  /** floating origin */
  shift(d) { for (const m of this.list) { m.position.sub(d); if (m.anchor) m.anchor.sub(d); if (m.tether) m.tether.mid.sub(d); } }
  dispose() { this.group.parent && this.group.parent.remove(this.group); if (this.tethers) this.tethers.parent && this.tethers.parent.remove(this.tethers); this.list = []; if (this.items) this.items = []; }
  update(dt, onDeath) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const m = this.list[i];
      m.rotation.x += m.spin.x * dt; m.rotation.y += m.spin.y * dt; m.rotation.z += m.spin.z * dt;
      if (m.hp <= 0 && !m.dead) { m.dead = true; this.group.remove(m); if (m.tether) this.tethers.remove(m.tether.line); this.list.splice(i, 1); if (onDeath) onDeath(m); continue; }
      if (m.tether) {   // the tether arcs with a slow wave and flickers; it thins as the cloud drains
        const th = m.tether, t = performance.now() / 1000;
        for (let k = 0; k <= th.N; k++) {
          const f = k / th.N; th.curve.getPoint(f, this._tmp);
          const w = Math.sin(f * Math.PI) * Math.sin(t * 1.8 + th.ph + f * 5) * 1.6;
          this._tmp.y += w; th.pos.set([this._tmp.x, this._tmp.y, this._tmp.z], k * 3);
        }
        th.line.geometry.attributes.position.needsUpdate = true;
        th.line.material.opacity = (0.3 + 0.25 * Math.max(0, Math.sin(t * 2.6 + th.ph))) * (0.4 + 0.6 * m.hp / m.hpMax);
      }
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
