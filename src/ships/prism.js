// "Prism": a wireframe pyramid nose, a gold spirograph lattice behind it, a core throwing electric tendrils backward,
// three concentric rings, and a double-helix tail. Everything hangs on one axis, forward is -Z.
import * as THREE from 'three';
import { COLORS } from '../config.js';
import { glowSprite } from '../materials.js';
import { TAU, rnd, damp, clamp } from '../utils.js';
import { Bender } from './bend.js';

export const id = 'prism';
export const name = 'Prism';
export const description = 'A crystal prow, spirograph lattices, a storm core and a helix wake. Opens into a mandala at rest, collapses into an arrow in flight.';

const add = (color, mult = 1.2, opacity = 0.8) => new THREE.LineBasicMaterial({ color: new THREE.Color(color).multiplyScalar(mult), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
const seg = (pts, mat) => new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), mat);

/** mystic rose: n points on a circle, every point joined to every k-th other; reads as the gold lattice in the reference */
function rose(n, R, skips, mat) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU, p = new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, 0);
    for (const k of skips) { const b = (i + k) / n * TAU; pts.push(p, new THREE.Vector3(Math.cos(b) * R, Math.sin(b) * R, 0)); }
  }
  return seg(pts, mat);
}
/** tendril: a Catmull-Rom curve from the core backward and outward, animated in update */
function tendril(i, n) {
  const a = i / n * TAU + rnd(-0.2, 0.2), r = rnd(1.6, 3.2), len = rnd(3, 6);
  const base = [[0, 0, 0], [Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, len * 0.25], [Math.cos(a) * r, Math.sin(a) * r, len * 0.55], [Math.cos(a + 0.5) * r * 1.2, Math.sin(a + 0.5) * r * 1.2, len * 0.85], [Math.cos(a + 1.1) * r * 0.9, Math.sin(a + 1.1) * r * 0.9, len]];
  return { base, phase: rnd(0, TAU), speed: rnd(1, 2.5), curve: new THREE.CatmullRomCurve3(base.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.7), samples: 22 };
}

export function build() {
  const group = new THREE.Group();

  // prow: wireframe pyramid (square base) pointing forward, with internal spokes like the reference
  const P = [new THREE.Vector3(0, 0, -7.5), new THREE.Vector3(-1.6, -1.2, -3.2), new THREE.Vector3(1.6, -1.2, -3.2), new THREE.Vector3(1.6, 1.2, -3.2), new THREE.Vector3(-1.6, 1.2, -3.2), new THREE.Vector3(0, 0, -3.2)];
  const prowPts = [];
  for (let i = 1; i <= 4; i++) { prowPts.push(P[0], P[i], P[i], P[i % 4 + 1], P[5], P[i]); }
  const PROW_Z = -5.0;   // the prow's own origin sits mid-way so bending places it on the arc
  const prowGroup = new THREE.Group(); prowGroup.position.z = PROW_Z; group.add(prowGroup);
  const prow = seg(prowPts.map((p) => p.clone().sub(new THREE.Vector3(0, 0, PROW_Z))), add(COLORS.sky, 1.4, 0.9)); prowGroup.add(prow);
  const prowTip = glowSprite(COLORS.ice, 1.4, 0.8); prowTip.position.set(0, 0, P[0].z - PROW_Z); prowGroup.add(prowTip);
  for (let i = 1; i <= 4; i++) { const s = glowSprite(COLORS.sky, 0.5, 0.9); s.position.copy(P[i]).sub(new THREE.Vector3(0, 0, PROW_Z)); prowGroup.add(s); }

  // lattice: two roses, a big one and a smaller one behind, counter-rotating
  // each rose sits in a carrier group: the carrier is placed on the arc, the rose spins inside it
  const roseA = rose(24, 2.9, [5, 9], add(COLORS.gold, 1.1, 0.5)), roseAc = new THREE.Group(); roseAc.add(roseA); group.add(roseAc);
  const roseB = rose(18, 2.0, [4, 7], add(COLORS.amber, 1.1, 0.45)), roseBc = new THREE.Group(); roseBc.add(roseB); group.add(roseBc);
  // spokes joining the roses so they read as one funnel
  const spokes = [];
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; spokes.push(new THREE.Vector3(Math.cos(a) * 2.9, Math.sin(a) * 2.9, -1.8), new THREE.Vector3(Math.cos(a + 0.4) * 2.0, Math.sin(a + 0.4) * 2.0, -0.6)); }
  const spokeLines = seg(spokes, add(COLORS.gold, 1, 0.3)); group.add(spokeLines);

  // core
  const CORE_Z = 0.6;
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(COLORS.white).multiplyScalar(0.9) }));
  core.position.z = CORE_Z; group.add(core);
  const coreGlow = [glowSprite(COLORS.white, 2.4, 0.45), glowSprite(COLORS.sky, 6, 0.2)];
  for (const g of coreGlow) { g.position.z = CORE_Z; group.add(g); }

  // tendrils: electric strands from the core, curling backward
  const tendrils = [];
  const N = 14;
  for (let i = 0; i < N; i++) {
    const t = tendril(i, N);
    const pos = new Float32Array(t.samples * 3);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const line = new THREE.Line(geo, add(i % 4 === 0 ? COLORS.gold : COLORS.sky, 1.3, 0.75));
    group.add(line);   // samples are written in ship space (core offset added), so the bend can act on them
    tendrils.push({ ...t, pos, line });
  }

  // rings: three concentric tori behind the core
  const rings = [2.6, 1.9, 1.2].map((r, i) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.05 + i * 0.01, 6, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(i === 1 ? COLORS.gold : COLORS.sky).multiplyScalar(1.3), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    const c = new THREE.Group(); c.add(m); c.position.z = 3.2 + i * 0.9; group.add(c); m.carrier = c; return m;
  });

  // helix tail: two strands twisted around the axis, plus a ladder between them; stretched with speed
  const HS = 80, helixPts = [[], []];
  for (let i = 0; i < HS; i++) {
    const t = i / (HS - 1), a = t * TAU * 2.5, r = 1.4 * (1 - t * 0.6);
    helixPts[0].push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, t));
    helixPts[1].push(new THREE.Vector3(-Math.cos(a) * r, -Math.sin(a) * r, t));
  }
  // the helix is rebuilt every frame in ship space (twist, stretch, bend), so its buffers are plain Float32Arrays
  const helixPos = [new Float32Array(HS * 3), new Float32Array(HS * 3)];
  const helixLines = helixPos.map((pos, k) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const l = new THREE.Line(g, add(k ? COLORS.sky : COLORS.gold, 1.2, 0.8)); group.add(l); return l; });
  const RUNGS = Math.ceil(HS / 5), rungPos = new Float32Array(RUNGS * 6);
  const rungGeo = new THREE.BufferGeometry(); rungGeo.setAttribute('position', new THREE.BufferAttribute(rungPos, 3));
  group.add(new THREE.LineSegments(rungGeo, add(COLORS.ice, 1, 0.35)));
  const helixBent = [helixPts[0].map((p) => p.clone()), helixPts[1].map((p) => p.clone())];   // this frame's world-space helix, for the sparks
  // sparks riding the helix
  const SP = 60, spos = new Float32Array(SP * 3), sparks = Array.from({ length: SP }, () => ({ t: Math.random(), k: Math.random() < 0.5 ? 0 : 1, v: rnd(0.3, 0.7) }));
  const sgeo = new THREE.BufferGeometry(); sgeo.setAttribute('position', new THREE.BufferAttribute(spos, 3));
  group.add(new THREE.Points(sgeo, new THREE.PointsMaterial({ color: COLORS.white, size: 0.14, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })));

  // engines: glow at the helix root, scaled by the ship code
  const engines = [glowSprite(COLORS.sky, 1.6, 0.7)]; engines[0].position.z = 5.4; group.add(engines[0]);
  const bend = new Bender();

  let t = 0, tail = 1, w = 0, helixTwist = 0;   // w: 0 = rest form (mandala), 1 = flight form (arrow)
  const tmp = new THREE.Vector3();
  const mix = (a, b) => a + (b - a) * w;
  function update(dt, state) {
    t += dt;
    const b = state.bend || { R: 0, side: 1, w: 0, spin: 0 }; bend.set(b.R, b.side, b.w, b.spin || 0);
    const energy = 0.35 + state.speedFrac * 0.65 + state.thrust * 0.3;
    w += (clamp(state.speedFrac * 2.2 + state.thrust * 0.5, 0, 1) - w) * damp(2.2, dt);

    // prow: retracted and slowly tumbling at rest, extended and locked forward in flight
    prow.scale.set(mix(1.3, 1), mix(1.3, 1), mix(0.55, 1.15)); prowTip.position.z = (P[0].z - PROW_Z) * prow.scale.z;
    prow.rotation.z += dt * mix(0.6, 0.25);
    bend.place(prowGroup, 0, 0, PROW_Z);
    // lattices: open sideways into a mandala at rest (tilted, spread apart, larger), face forward in flight
    roseA.rotation.x = mix(Math.sin(t * 0.5) * 0.9, 0); roseB.rotation.x = mix(Math.cos(t * 0.4) * 0.9, 0);
    roseA.rotation.y = mix(t * 0.3, 0); roseB.rotation.y = mix(-t * 0.35, 0);
    bend.place(roseAc, 0, 0, mix(-2.6, -1.8)); bend.place(roseBc, 0, 0, mix(2.2, -0.6));
    spokeLines.visible = bend.k < 1e-5; bend.place(core, 0, 0, CORE_Z); for (const g of coreGlow) bend.place(g, 0, 0, CORE_Z);
    roseA.scale.setScalar(mix(1.5, 1)); roseB.scale.setScalar(mix(1.4, 1));
    roseA.rotation.z += dt * 0.35 * energy; roseB.rotation.z -= dt * 0.55 * energy;
    prowTip.material.opacity = 0.5 + 0.4 * Math.sin(t * 6) * state.speedFrac;
    // rings: drift apart and wobble at rest, stack tight on the axis in flight
    for (let i = 0; i < rings.length; i++) {
      const r = rings[i];
      r.scale.setScalar(mix(1.5, 1) + 0.06 * Math.sin(t * 3 + i * 1.2));
      bend.place(r.carrier, 0, 0, mix(3.2 + i * 2.4, 3.2 + i * 0.9));
      r.rotation.x = mix(Math.sin(t * 0.7 + i) * 0.6, 0); r.rotation.y = mix(Math.cos(t * 0.5 + i * 2) * 0.6, 0);
      r.material.opacity = 0.5 + 0.35 * (0.5 + 0.5 * Math.sin(t * 4 - i * 1.5)) * energy;
    }
    // tendrils: writhe, and sweep back harder as the ship moves
    const sweep = 1 + state.speedFrac * 1.3;
    for (const td of tendrils) {
      const pts = td.curve.points;
      for (let c = 0; c < pts.length; c++) {
        const b = td.base[c], k = c / (pts.length - 1);
        const spread = mix(1.8, 1 - state.speedFrac * 0.4), back = mix(0.35, sweep);   // rest: bristle out sideways; flight: sweep back
        pts[c].set(b[0] * spread + Math.sin(t * td.speed + td.phase + c) * 0.35 * k, b[1] * spread + Math.cos(t * td.speed * 1.3 + td.phase + c) * 0.35 * k, b[2] * back);
      }
      td.curve.updateArcLengths();
      for (let i = 0; i < td.samples; i++) { td.curve.getPoint(i / (td.samples - 1), tmp); tmp.z += CORE_Z; bend.point(tmp); td.pos.set([tmp.x, tmp.y, tmp.z], i * 3); }
      td.line.geometry.attributes.position.needsUpdate = true;
      td.line.material.opacity = 0.45 + 0.4 * (0.5 + 0.5 * Math.sin(t * 5 * td.speed + td.phase)) * energy;
    }
    // helix: twist and stretch
    tail += ((mix(1.5, 4) + state.speedFrac * 9 + state.thrust * 3) - tail) * damp(3, dt);
    const hz = mix(9.0, 5.4), hr = mix(1.6, 1); bend.place(engines[0], 0, 0, hz);
    helixTwist -= dt * (1.5 + state.speedFrac * 3);
    for (let k = 0; k < 2; k++) {
      for (let i = 0; i < HS; i++) {
        const p = helixPts[k][i], ca = Math.cos(helixTwist), sa = Math.sin(helixTwist);
        tmp.set((p.x * ca - p.y * sa) * hr, (p.x * sa + p.y * ca) * hr, hz + p.z * tail);
        bend.point(tmp); helixBent[k][i].copy(tmp); helixPos[k].set([tmp.x, tmp.y, tmp.z], i * 3);
      }
      helixLines[k].geometry.attributes.position.needsUpdate = true;
    }
    for (let i = 0, r = 0; i < HS; i += 5, r++) { const a = helixBent[0][i], b2 = helixBent[1][i]; rungPos.set([a.x, a.y, a.z, b2.x, b2.y, b2.z], r * 6); }
    rungGeo.attributes.position.needsUpdate = true;
    for (let i = 0; i < SP; i++) { const s = sparks[i]; s.t = (s.t + s.v * dt) % 1; const p = helixBent[s.k][Math.floor(s.t * (HS - 1))]; spos.set([p.x, p.y, p.z], i * 3); }
    sgeo.attributes.position.needsUpdate = true;
    // core
    const pulse = 0.5 + 0.5 * Math.sin(t * 5);
    core.scale.setScalar(0.9 + pulse * 0.15 + state.thrust * 0.2);
    coreGlow[0].scale.setScalar(2.4 + pulse * 0.3 + state.thrust * 0.6);
    coreGlow[1].scale.setScalar(6 + state.thrust * 1.5);
  }
  return { group, engines, update };
}
