// The player's vessel is bound energy, not a hull. A hot core, a set of energy strands and a cloud of motes.
// The strands morph between forms depending on what the ship is doing:
//   Lance  - flying: strands bundle into a spear, tail streams out with thrust
//   Bloom  - idle:   strands unfold into petals around the core
//   Halo   - orbit:  strands wrap into a tilted ring, leaning toward the target
// Every strand is a Catmull-Rom curve through control points; the points of the three forms are blended by weight each
// frame and resampled, so the morph is continuous. Forward is -Z.
import * as THREE from 'three';
import { COLORS } from '../config.js';
import { glowSprite } from '../materials.js';
import { TAU, rnd, damp, clamp } from '../utils.js';

const STRANDS = 16;
const CTRL = 6;              // control points per strand
const SAMPLES = 28;          // line points per strand
const MOTES = 90;

const strandColors = [COLORS.cyan, COLORS.ice, COLORS.gold, COLORS.white, COLORS.sky];

/** control points for one strand, index i of n, in the three forms */
function forms(i, n) {
  const a = i / n * TAU, s = Math.sin(a), c = Math.cos(a), j = (i % 3) - 1;   // j: -1, 0, 1 for some variety
  // lance: strands spiral around the axis (angle advances with z), pinched at the nose, flared at the waist, streaming at the tail
  const spiral = (r, z, k) => { const t = a + k * 0.9; return [Math.cos(t) * r, Math.sin(t) * r * 0.75, z]; };
  const lance = [
    [0, 0, -6.8],
    spiral(0.3, -4.4, 1),
    spiral(1.5 + j * 0.15, -1.6, 2),
    spiral(2.3, 0.6, 3),
    spiral(1.3, 3.0, 4),
    spiral(0.5 + (i % 2) * 0.5, 6.5, 5),
  ];
  const bloom = [
    [0, 0, 0],
    [c * 1.2, s * 1.2, -0.6],
    [c * 2.6, s * 2.6, -0.2],
    [c * 3.3, s * 3.3, 0.9],
    [c * 2.4, s * 2.4, 2.2],
    [c * 0.9, s * 0.9, 2.6],
  ];
  // halo: strand i covers an arc of the ring, tilted 35 degrees, some strands on an inner ring
  const R = i % 2 ? 2.6 : 3.4, tilt = 0.6, halo = [];
  for (let k = 0; k < CTRL; k++) {
    const t = a + (k / (CTRL - 1)) * (TAU / n) * 2.4;      // arcs overlap their neighbours
    const x = Math.cos(t) * R, z = Math.sin(t) * R;
    halo.push([x, Math.sin(t) * R * Math.sin(tilt) * 0.5 + Math.sin(t * 3) * 0.15, z * Math.cos(tilt)]);
  }
  return { lance, bloom, halo };
}

export const id = 'bloom';
export const name = 'Bloom';
export const description = 'Bound strands that unfold into petals at rest, bundle into a lance in flight, and wrap into a halo in orbit.';

export function build() {
  const group = new THREE.Group();

  // core: a small hot sphere inside stacked glow sprites
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(COLORS.white).multiplyScalar(0.85) }));
  group.add(core);
  const coreGlow = [glowSprite(COLORS.white, 2.2, 0.4), glowSprite(COLORS.cyan, 5.0, 0.18), glowSprite(COLORS.violet, 10, 0.06)];
  for (const g of coreGlow) group.add(g);

  // strands
  const strands = [];
  for (let i = 0; i < STRANDS; i++) {
    const f = forms(i, STRANDS);
    const pos = new Float32Array(SAMPLES * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const color = new THREE.Color(strandColors[i % strandColors.length]).multiplyScalar(1.15);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    const line = new THREE.Line(geo, mat);
    group.add(line);
    strands.push({ line, f, pos, phase: rnd(0, TAU), speed: rnd(0.6, 1.4), curve: new THREE.CatmullRomCurve3(Array.from({ length: CTRL }, () => new THREE.Vector3()), false, 'catmullrom', 0.6) });
  }

  // motes: points orbiting the core, radius follows the form
  const mpos = new Float32Array(MOTES * 3), mcol = new Float32Array(MOTES * 3), motes = [];
  const tint = new THREE.Color();
  for (let i = 0; i < MOTES; i++) {
    motes.push({ a: rnd(0, TAU), b: rnd(0, TAU), w: rnd(0.4, 1.6) * (Math.random() < 0.5 ? 1 : -1), r: rnd(0.7, 1.3) });
    tint.set(strandColors[i % strandColors.length]).multiplyScalar(rnd(0.6, 1.1));
    mcol.set([tint.r, tint.g, tint.b], i * 3);
  }
  const mgeo = new THREE.BufferGeometry();
  mgeo.setAttribute('position', new THREE.BufferAttribute(mpos, 3));
  mgeo.setAttribute('color', new THREE.BufferAttribute(mcol, 3));
  group.add(new THREE.Points(mgeo, new THREE.PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })));

  // lance extras: hot nose tip and a spinning ring at the waist, both faded in with the lance weight
  const nose = glowSprite(COLORS.white, 1.6, 0); nose.position.set(0, 0, -6.4); group.add(nose);
  const ringMat = new THREE.LineBasicMaterial({ color: new THREE.Color(COLORS.gold).multiplyScalar(1.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const ringPts = []; for (let i = 0; i <= 48; i++) { const a = i / 48 * TAU; ringPts.push(new THREE.Vector3(Math.cos(a) * 2.5, Math.sin(a) * 1.9, 0)); }
  const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ringPts), ringMat); ring.position.z = 0.6; group.add(ring);
  const ring2 = ring.clone(); ring2.scale.setScalar(0.55); ring2.position.z = -2.4; group.add(ring2);

  // tail: two glow sprites the ship scales with thrust (kept as `engines` for the ship code)
  const engines = [0.5, -0.5].map((x) => { const e = glowSprite(COLORS.cyan, 1.4, 0.7); e.position.set(x, 0, 3.6); group.add(e); return e; });

  // form weights, smoothed
  const w = { lance: 0, bloom: 1, halo: 0 };
  let t = 0;
  const tmp = new THREE.Vector3();

  /** state: { thrust 0..1, speedFrac 0..1, orbiting bool, targetDir (world->local vector or null) } */
  function update(dt, state) {
    t += dt;
    const wantHalo = state.orbiting ? 1 : 0;
    const wantLance = state.orbiting ? 0 : clamp(state.speedFrac * 1.6, 0, 1);
    const wantBloom = 1 - Math.max(wantHalo, wantLance);
    const k = damp(2.5, dt);
    w.lance += (wantLance - w.lance) * k; w.bloom += (wantBloom - w.bloom) * k; w.halo += (wantHalo - w.halo) * k;
    const stretch = 1 + state.thrust * 0.9 + state.speedFrac * 0.8;   // lance tail streams out with thrust and speed

    for (const s of strands) {
      const pts = s.curve.points;
      for (let c = 0; c < CTRL; c++) {
        const L = s.f.lance[c], B = s.f.bloom[c], H = s.f.halo[c];
        let x = L[0] * w.lance + B[0] * w.bloom + H[0] * w.halo;
        let y = L[1] * w.lance + B[1] * w.bloom + H[1] * w.halo;
        let z = L[2] * w.lance + B[2] * w.bloom + H[2] * w.halo;
        if (z > 0) z *= 1 + (stretch - 1) * w.lance;
        // living wobble, stronger away from the core
        const wob = 0.12 * (c / (CTRL - 1));
        x += Math.sin(t * 2.2 * s.speed + s.phase + c) * wob;
        y += Math.cos(t * 1.7 * s.speed + s.phase * 1.3 + c) * wob;
        pts[c].set(x, y, z);
      }
      s.curve.updateArcLengths();
      for (let i = 0; i < SAMPLES; i++) { s.curve.getPoint(i / (SAMPLES - 1), tmp); s.pos.set([tmp.x, tmp.y, tmp.z], i * 3); }
      s.line.geometry.attributes.position.needsUpdate = true;
      s.line.material.opacity = 0.55 + 0.35 * Math.sin(t * 3 * s.speed + s.phase) * 0.5 + 0.2;
    }

    // motes: spin around the core; the cloud stretches into the lance and flattens into the halo
    const rBloom = 3.2, rLance = 1.6, rHalo = 3.0;
    for (let i = 0; i < MOTES; i++) {
      const m = motes[i]; m.a += m.w * dt;
      const r = m.r * (rBloom * w.bloom + rLance * w.lance + rHalo * w.halo);
      const x = Math.cos(m.a) * r, yy = Math.sin(m.a) * Math.sin(m.b) * r, z = Math.sin(m.a) * Math.cos(m.b) * r;
      const flat = 1 - w.halo * 0.75;                             // halo squashes the cloud toward the ring plane
      mpos.set([x, yy * flat, z * (1 + w.lance * 1.2)], i * 3);
    }
    mgeo.attributes.position.needsUpdate = true;

    // lance extras
    nose.material.opacity = w.lance * (0.6 + 0.3 * Math.sin(t * 9));
    nose.scale.setScalar(0.8 + w.lance * (0.8 + state.thrust * 0.6));
    ringMat.opacity = w.lance * 0.7;
    ring.rotation.z += dt * 2.4; ring2.rotation.z -= dt * 3.5;
    ring.position.z = 0.6 + Math.sin(t * 2) * 0.3;

    // core breathes; brighter under thrust
    const pulse = 0.5 + 0.5 * Math.sin(t * 4);
    core.scale.setScalar(0.9 + pulse * 0.15 + state.thrust * 0.2);
    coreGlow[0].scale.setScalar(2.2 + pulse * 0.3 + state.thrust * 0.6);
    coreGlow[1].scale.setScalar(5.0 + pulse * 0.5 + state.thrust * 1.2);
    coreGlow[2].material.opacity = 0.06 + state.thrust * 0.08 + w.bloom * 0.04;
  }

  return { group, engines, update };
}
