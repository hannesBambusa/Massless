// "Kite": a solar sail. A slender spine with two vast translucent membranes that ripple like cloth in a light wind.
// The only design built from surfaces rather than strands or orbs: sheer green-blue fabric, veined, edge-lit.
//   Spread - idle:   wings out flat and wide, slow rolling ripples, a manta at rest
//   Swept  - flight: wings fold back along the spine into a narrow dart, ripples flatten into fast streaks
//   Banked - orbit:  one wing dips, the other lifts, the sail leans into the turn
// Wing vertices are recomputed every frame (spread, sweep, ripple), then bent along the flight path. Forward is -Z.
import * as THREE from 'three';
import { COLORS } from '../config.js';
import { glowSprite } from '../materials.js';
import { TAU, rnd, damp, clamp } from '../utils.js';
import { Bender } from './bend.js';

export const id = 'kite';
export const name = 'Kite';
export const description = 'A solar sail: two sheer, veined membranes on a slender spine. Spread wide and rippling at rest, swept into a dart in flight, banked in orbit.';

const SPAN = 12, CHORD = 7;    // wing grid: segments spanwise, chordwise
const WING_SPAN = 6.5, WING_CHORD = 5.5;
const lineMat = (color, mult = 1.2, opacity = 0.8) => new THREE.LineBasicMaterial({ color: new THREE.Color(color).multiplyScalar(mult), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });

/** one wing: a grid mesh (membrane) plus a wireframe pass (veins) sharing the geometry, and a bright leading edge line */
function wing(side) {
  const geo = new THREE.PlaneGeometry(1, 1, SPAN, CHORD);
  const membrane = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(COLORS.green).multiplyScalar(0.9), transparent: true, opacity: 0.16, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  const veins = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(COLORS.green).multiplyScalar(1.1), wireframe: true, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
  const edgePos = new Float32Array((SPAN + 1) * 3), edgeGeo = new THREE.BufferGeometry(); edgeGeo.setAttribute('position', new THREE.BufferAttribute(edgePos, 3));
  const edge = new THREE.Line(edgeGeo, lineMat(COLORS.ice, 1.3, 0.9));
  for (const o of [membrane, veins, edge]) o.frustumCulled = false;
  return { side, geo, membrane, veins, edge, edgePos, pos: geo.attributes.position.array };
}

export function build() {
  const group = new THREE.Group();

  // spine: a bright line from nose to tail, rebuilt each frame so it bends; nose bead and a tail bead
  const SN = 24, spinePos = new Float32Array(SN * 3), spineGeo = new THREE.BufferGeometry(); spineGeo.setAttribute('position', new THREE.BufferAttribute(spinePos, 3));
  const spine = new THREE.Line(spineGeo, lineMat(COLORS.ice, 1.4, 0.95)); spine.frustumCulled = false; group.add(spine);
  const NOSE = -6.5, TAIL = 4.5;
  const nose = glowSprite(COLORS.white, 1.4, 0.8); group.add(nose);
  const keel = new THREE.Mesh(new THREE.ConeGeometry(0.28, 2.2, 6), new THREE.MeshBasicMaterial({ color: COLORS.hull }));
  keel.rotation.x = -Math.PI / 2; const keelC = new THREE.Group(); keelC.add(keel); group.add(keelC);
  const keelEdge = new THREE.LineSegments(new THREE.EdgesGeometry(keel.geometry, 1), lineMat(COLORS.green, 1.2, 0.8)); keelEdge.rotation.x = -Math.PI / 2; keelC.add(keelEdge);

  // wings
  const wings = [wing(-1), wing(1)];
  for (const w of wings) group.add(w.membrane, w.veins, w.edge);

  // tip motes: dust shed from each wingtip, drifting back
  const TM = 40, tpos = new Float32Array(TM * 3), tmotes = Array.from({ length: TM }, (_, i) => ({ side: i % 2 ? 1 : -1, t: Math.random(), v: rnd(0.4, 0.9), y: rnd(-0.3, 0.3) }));
  const tgeo = new THREE.BufferGeometry(); tgeo.setAttribute('position', new THREE.BufferAttribute(tpos, 3));
  const tips = new THREE.Points(tgeo, new THREE.PointsMaterial({ color: new THREE.Color(COLORS.green).multiplyScalar(1.2), size: 0.12, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false })); tips.frustumCulled = false; group.add(tips);
  const tipNow = [new THREE.Vector3(), new THREE.Vector3()];   // this frame's wingtip positions (unbent ship space)

  // engines: one soft glow at the tail bead
  const engines = [glowSprite(COLORS.green, 1.5, 0.6)]; engines[0].position.z = TAIL; group.add(engines[0]);

  const bend = new Bender();
  let t = 0, sweep = 0, bank = 0;    // sweep: 0 spread, 1 swept; bank: -1..1 lean
  const tmp = new THREE.Vector3();

  function update(dt, state) {
    t += dt;
    const b = state.bend; if (b) bend.set(b.trail, b.scale, b.inv, b.invQ, b.spin || 0);
    const wantSweep = clamp(state.speedFrac * 1.7 + state.thrust * 0.4, 0, 1) * (state.orbiting ? 0.55 : 1);
    sweep += (wantSweep - sweep) * damp(2.2, dt);
    bank += ((state.orbiting ? 1 : 0) - bank) * damp(1.8, dt);
    const energy = 0.4 + state.speedFrac * 0.6 + state.thrust * 0.3;

    // wings: u spanwise 0 (root) .. 1 (tip); v chordwise 0 (leading edge) .. 1 (trailing edge)
    const span = WING_SPAN * (1 - sweep * 0.45), chord = WING_CHORD * (1 + sweep * 0.25);
    const ripAmp = 0.35 * (1 - sweep * 0.8), ripFreq = 2.2 + sweep * 6;
    for (const w of wings) {
      const s = w.side, lean = bank * s * 0.55;   // orbit: the outer wing lifts, the inner dips
      for (let j = 0; j <= CHORD; j++) for (let i = 0; i <= SPAN; i++) {
        const u = i / SPAN, v = j / CHORD, k = (j * (SPAN + 1) + i) * 3;
        const x = s * u * span * (0.15 + 0.85 * Math.sqrt(u) / Math.sqrt(1));           // wing root narrow, tip full
        // sweep: the leading edge slopes back with u, more so in flight; chord tapers toward the tip
        const lead = -3.6 + u * (1.6 + sweep * 7.5), c = chord * (1 - u * 0.55);
        const z = lead + v * c;
        // ripple: waves travelling root to tip, plus a slower breathing camber; damped at the root so it stays attached
        const ripple = Math.sin(u * 4 - t * ripFreq + v * 1.5) * ripAmp * u + Math.sin(t * 0.9 + s) * 0.15 * u * (1 - sweep);
        const y = ripple + lean * u * span * 0.35 + Math.sin(u * Math.PI) * 0.25 * (1 - sweep);
        tmp.set(x, y, z); bend.point(tmp);
        w.pos[k] = tmp.x; w.pos[k + 1] = tmp.y; w.pos[k + 2] = tmp.z;
        if (j === 0) w.edgePos.set([tmp.x, tmp.y, tmp.z], i * 3);
        if (j === 0 && i === SPAN) tipNow[s > 0 ? 1 : 0].set(x, y, z);
      }
      w.geo.attributes.position.needsUpdate = true; w.geo.computeVertexNormals();
      w.edge.geometry.attributes.position.needsUpdate = true;
      w.membrane.material.opacity = 0.12 + 0.08 * (0.5 + 0.5 * Math.sin(t * 1.4 + s)) * energy;
      w.veins.material.opacity = 0.14 + 0.16 * energy;
      w.edge.material.opacity = 0.6 + 0.35 * energy;
    }

    // spine, beads, keel
    for (let i = 0; i < SN; i++) { tmp.set(0, 0, NOSE + (TAIL - NOSE) * i / (SN - 1)); bend.point(tmp); spinePos.set([tmp.x, tmp.y, tmp.z], i * 3); }
    spineGeo.attributes.position.needsUpdate = true;
    bend.place(nose, 0, 0, NOSE); nose.material.opacity = 0.5 + 0.4 * Math.sin(t * 5) * 0.5 + 0.2 * state.speedFrac;
    bend.place(keelC, 0, -0.15, -3.0); keelC.scale.z = 1 + sweep * 0.6;
    bend.place(engines[0], 0, 0, TAIL);

    // tip motes: shed from the wingtips, drifting back and fading; fast and straight in flight, lazy and wide at rest
    const back = 3 + state.speedFrac * 9;
    for (let i = 0; i < TM; i++) {
      const m = tmotes[i]; m.t = (m.t + m.v * dt * (0.6 + state.speedFrac)) % 1;
      const tip = tipNow[m.side > 0 ? 1 : 0];
      tmp.set(tip.x + m.side * m.t * 0.4 * (1 - sweep), tip.y + m.y + Math.sin(t * 3 + i) * 0.1 * (1 - sweep), tip.z + m.t * back);
      bend.point(tmp); tpos.set([tmp.x, tmp.y, tmp.z], i * 3);
    }
    tgeo.attributes.position.needsUpdate = true;
    tips.material.opacity = 0.3 + 0.5 * state.speedFrac;
  }
  return { group, engines, update };
}
