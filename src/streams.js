// Energy streams: long helical ribbons that wind through the sector. Each has a drifting spine, three twisted strands
// around it, a wireframe lattice between the strands, and sparkles that flow along it. Gold and blue, additive, so bloom does the rest.
import * as THREE from 'three';
import { COLORS, WORLD } from './config.js';
import { rnd, TAU, pick } from './utils.js';

const SPINE_PTS = 14, SAMPLES = 260, STRANDS = 3, SPARKS = 220;
const palettes = [[COLORS.gold, COLORS.amber, COLORS.white], [COLORS.sky, COLORS.ice, COLORS.white], [COLORS.gold, COLORS.sky, COLORS.ice]];

function spine(centre) {
  const half = WORLD.clusterRadius * 0.6, pts = [];
  const dir = new THREE.Vector3(rnd(-1, 1), rnd(-0.25, 0.25), rnd(-1, 1)).normalize();
  const start = centre.clone().add(new THREE.Vector3(rnd(-half, half), rnd(-half * 0.3, half * 0.3), rnd(-half, half))).addScaledVector(dir, -WORLD.size * 0.6);
  const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
  for (let i = 0; i < SPINE_PTS; i++) {
    const t = i / (SPINE_PTS - 1);
    const p = start.clone().addScaledVector(dir, t * WORLD.size * 1.2);
    p.addScaledVector(side, Math.sin(t * TAU * 0.9 + rnd(0, 0.3)) * 160);   // slow S-curve
    p.y += Math.sin(t * TAU * 0.6) * 80;
    pts.push(p);
  }
  return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
}

export class Streams {
  /** centres: harvest site positions; each gets WORLD.streams streams winding through it */
  constructor(scene, centres) {
    this.group = new THREE.Group();
    this.items = [];
    for (const c of centres) for (let n = 0; n < WORLD.streams; n++) this.items.push(this.build(pick(palettes), c));
    scene.add(this.group);
  }
  /** a random point on a stream near `centre` (within `within`), for growing condensates on; null if none */
  randomPointNear(centre, within) {
    const cand = [];
    for (const it of this.items) for (const pts of it.strandPts) for (let i = 0; i < pts.length; i += 6) if (pts[i].distanceTo(centre) < within) cand.push(pts[i]);
    return cand.length ? pick(cand).clone() : null;
  }

  build(palette, centre) {
    const curve = spine(centre), frames = curve.computeFrenetFrames(SAMPLES, false);
    const R = rnd(14, 30), twist = rnd(2.5, 4.5) * TAU, phase0 = rnd(0, TAU);
    const strandPts = [];
    const p = new THREE.Vector3();
    for (let k = 0; k < STRANDS; k++) {
      const pts = [];
      for (let i = 0; i < SAMPLES; i++) {
        const t = i / (SAMPLES - 1), a = phase0 + k * TAU / STRANDS + t * twist;
        const r = R * (0.75 + 0.25 * Math.sin(t * TAU * 3 + k));
        curve.getPointAt(t, p);
        pts.push(p.clone().addScaledVector(frames.normals[i], Math.cos(a) * r).addScaledVector(frames.binormals[i], Math.sin(a) * r));
      }
      strandPts.push(pts);
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: new THREE.Color(palette[k % palette.length]).multiplyScalar(1.1), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
      this.group.add(line);
    }
    // lattice: thin segments between strands every few samples, alternating so it triangulates
    const seg = [];
    for (let i = 0; i < SAMPLES; i += 4) {
      for (let k = 0; k < STRANDS; k++) {
        const a = strandPts[k][i], b = strandPts[(k + 1) % STRANDS][Math.min(SAMPLES - 1, i + 2)];
        seg.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
    const lat = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(seg, 3)), new THREE.LineBasicMaterial({ color: palette[2], transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.group.add(lat);
    // sparkles flowing along the strands
    const spos = new Float32Array(SPARKS * 3), scol = new Float32Array(SPARKS * 3), sparks = [], tint = new THREE.Color();
    for (let i = 0; i < SPARKS; i++) {
      sparks.push({ t: Math.random(), k: i % STRANDS, v: rnd(0.01, 0.03) });
      tint.set(pick(palette)).multiplyScalar(rnd(0.8, 1.6)); scol.set([tint.r, tint.g, tint.b], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(spos, 3)); sg.setAttribute('color', new THREE.BufferAttribute(scol, 3));
    const pts = new THREE.Points(sg, new THREE.PointsMaterial({ size: 2.2, vertexColors: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
    pts.frustumCulled = false; this.group.add(pts);
    return { strandPts, sparks, spos, sg };
  }

  dispose() { this.group.parent && this.group.parent.remove(this.group); if (this.tethers) this.tethers.parent && this.tethers.parent.remove(this.tethers); this.list = []; if (this.items) this.items = []; }
  update(dt) {
    for (const it of this.items) {
      for (let i = 0; i < it.sparks.length; i++) {
        const s = it.sparks[i]; s.t = ((s.t + s.v * dt) % 1 + 1) % 1;
        const pts = it.strandPts[s.k], idx = Math.min(SAMPLES - 1, Math.floor(s.t * (SAMPLES - 1))), q = pts[idx];
        it.spos.set([q.x, q.y, q.z], i * 3);
      }
      it.sg.attributes.position.needsUpdate = true;
    }
  }
}
