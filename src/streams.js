// Energy streams: long helical ribbons that wind through the sector. Each has a drifting spine, three twisted strands
// around it, a wireframe lattice between the strands, and sparkles that flow along it. Gold and blue, additive, so bloom does the rest.
import * as THREE from 'three';
import { COLORS, WORLD } from './config.js';
import { rnd, TAU, pick } from './utils.js';

const SPINE_PTS = 14, SAMPLES = 260, STRANDS = 3, SPARKS = 220;
/** 1 in the middle of a strand, easing to 0 over the last 18% at either end */
const fadeEnd = (f) => { const e = 0.18, d = Math.min(f, 1 - f); return d >= e ? 1 : Math.pow(d / e, 1.5); };
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
    for (const it of this.items) for (const pts of it.strandPts) for (let i = 0; i < pts.length; i += 6) { const w = pts[i].clone().add(it.g.position); if (w.distanceTo(centre) < within) cand.push(w); }
    return cand.length ? pick(cand) : null;
  }

  build(palette, centre) {
    // everything is built relative to `origin` (the site centre) and hung on a group placed there. Geometry stays small
    // and precise; only the group's position (a double on the CPU) carries the astronomical offset.
    const origin = centre.clone();
    const g = new THREE.Group(); g.position.copy(origin); this.group.add(g);
    const curve = spine(new THREE.Vector3()), frames = curve.computeFrenetFrames(SAMPLES, false);
    const R = rnd(14, 30), twist = rnd(2.5, 4.5) * TAU, phase0 = rnd(0, TAU);
    const strandPts = [], lines = [];
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
      // fade at both ends: vertex colours run to black over the last 18% of the strand, which is invisible under additive blending
      const geo = new THREE.BufferGeometry().setFromPoints(pts), col = new Float32Array(SAMPLES * 3), base = new THREE.Color(palette[k % palette.length]).multiplyScalar(1.1);
      for (let i = 0; i < SAMPLES; i++) { const f = i / (SAMPLES - 1), e = fadeEnd(f); col.set([base.r * e, base.g * e, base.b * e], i * 3); }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
      line.frustumCulled = false; g.add(line); lines.push(line);
    }
    // lattice: thin segments between strands every few samples, alternating so it triangulates
    const seg = [], segCol = [], latBase = new THREE.Color(palette[2]);
    for (let i = 0; i < SAMPLES; i += 4) {
      const e = fadeEnd(i / (SAMPLES - 1));
      for (let k = 0; k < STRANDS; k++) {
        const a = strandPts[k][i], b = strandPts[(k + 1) % STRANDS][Math.min(SAMPLES - 1, i + 2)];
        seg.push(a.x, a.y, a.z, b.x, b.y, b.z);
        segCol.push(latBase.r * e, latBase.g * e, latBase.b * e, latBase.r * e, latBase.g * e, latBase.b * e);
      }
    }
    const latGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(seg, 3)).setAttribute('color', new THREE.Float32BufferAttribute(segCol, 3));
    const lat = new THREE.LineSegments(latGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }));
    lat.frustumCulled = false; g.add(lat); lines.push(lat);
    // sparkles flowing along the strands
    const spos = new Float32Array(SPARKS * 3), scol = new Float32Array(SPARKS * 3), sparks = [], tint = new THREE.Color();
    for (let i = 0; i < SPARKS; i++) {
      sparks.push({ t: rnd(0.15, 0.85), k: i % STRANDS, v: rnd(0.01, 0.03) });
      tint.set(pick(palette)).multiplyScalar(rnd(0.8, 1.6)); scol.set([tint.r, tint.g, tint.b], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(spos, 3)); sg.setAttribute('color', new THREE.BufferAttribute(scol, 3));
    const pts = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.4, vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
    pts.frustumCulled = false; g.add(pts);
    return { g, strandPts, sparks, spos, sg, lines };
  }

  /** floating origin: move every stream by -d */
  shift(d) { for (const it of this.items) it.g.position.sub(d); }
  dispose() { this.group.parent && this.group.parent.remove(this.group); if (this.tethers) this.tethers.parent && this.tethers.parent.remove(this.tethers); this.list = []; if (this.items) this.items = []; }
  update(dt) {
    for (const it of this.items) {
      for (let i = 0; i < it.sparks.length; i++) {
        const s = it.sparks[i]; s.t += s.v * dt; if (s.t > 0.85) s.t = 0.15;   // sparks live on the bright middle of the strand
        // glide between samples instead of snapping to them
        const pts = it.strandPts[s.k], f = s.t * (SAMPLES - 1), idx = Math.min(SAMPLES - 2, Math.floor(f)), fr = f - idx;
        const a = pts[idx], b = pts[idx + 1];
        it.spos.set([a.x + (b.x - a.x) * fr, a.y + (b.y - a.y) * fr, a.z + (b.z - a.z) * fr], i * 3);
      }
      it.sg.attributes.position.needsUpdate = true;
    }
  }
}
