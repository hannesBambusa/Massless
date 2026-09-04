// "Shoal": no hull at all, a school of small glowing orbs swimming around a dark heart. Magenta and ember tones, unlike the
// cyan Bloom or the gold Prism. Each shard follows its own place in the current formation with a little lag, so the
// swarm breathes and ripples instead of snapping:
//   School - idle:   shards drift on a slow tumbling shell around the heart
//   Wedge  - flight: shards fall into stacked chevrons behind a lead shard, a flock in arrow formation
//   Comet  - orbit:  shards stream back into a long tail leaning off the heart
// Each shard leaves a short ghost trail. Forward is -Z.
import * as THREE from 'three';
import { COLORS } from '../config.js';
import { glowSprite } from '../materials.js';
import { TAU, rnd, damp, clamp } from '../utils.js';
import { Bender } from './bend.js';

export const id = 'shoal';
export const name = 'Shoal';
export const description = 'A school of coloured orbs circling a dark heart. Drifts as a shell at rest, locks into stacked chevrons in flight, streams into a comet tail in orbit.';

const SHARDS = 18;
const GHOST = 7;                // trail points per shard
const palette = [COLORS.magenta, COLORS.violet, COLORS.red, COLORS.orange, COLORS.gold, COLORS.cyan, COLORS.green, COLORS.white];
const lineMat = (color, mult = 1.3, opacity = 0.9) => new THREE.LineBasicMaterial({ color: new THREE.Color(color).multiplyScalar(mult), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });

/** one shard: a miniature of the heart, a dark sphere with a coloured ember inside, a wire cage in that colour and a faint halo */
function shardMesh(color, size) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(size * 0.5, 12, 8), new THREE.MeshBasicMaterial({ color: COLORS.hull })));
  const ember = new THREE.Mesh(new THREE.SphereGeometry(size * 0.22, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.3) })); g.add(ember); g.ember = ember;
  const cage = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(size * 0.64, 1), 1), lineMat(color, 1.0, 0.5)); g.add(cage); g.cage = cage;
  const halo = glowSprite(color, size * 1.6, 0.18); g.add(halo); g.halo = halo;
  return g;
}

/** formation targets for shard i of n, in ship space */
function forms(i, n) {
  const f = i / n, a = f * TAU * 3.7;          // golden-ish spread over the shell
  const lat = Math.acos(1 - 2 * (i + 0.5) / n);  // even latitude spread
  const R = 3.4;
  const school = [Math.sin(lat) * Math.cos(a) * R, Math.sin(lat) * Math.sin(a) * R * 0.8, Math.cos(lat) * R];
  // wedge: rows of chevrons, 4 per row, each row further back and wider
  const row = Math.floor(i / 4), k = i % 4, side = k % 2 ? 1 : -1, tier = Math.floor(k / 2);
  const spread = 0.9 + row * 0.55, z = -4.5 + row * 1.15 + tier * 0.4;
  const wedge = [side * spread * (0.6 + tier * 0.7), (tier ? -0.35 : 0.35) * (1 + row * 0.15), z];
  // comet: a tight nose and a long spiral tail behind the heart
  const ct = i / n, ca = ct * TAU * 2.2, cr = 0.4 + ct * 1.6;
  const comet = [Math.cos(ca) * cr, Math.sin(ca) * cr * 0.6, -1.5 + ct * 9];
  return { school, wedge, comet };
}

export function build() {
  const group = new THREE.Group();

  // heart: dark sphere with an ember inside and a magenta rim
  const heart = new THREE.Mesh(new THREE.SphereGeometry(0.75, 20, 14), new THREE.MeshBasicMaterial({ color: COLORS.hull }));
  group.add(heart);
  const ember = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(COLORS.orange).multiplyScalar(1.6) }));
  group.add(ember);
  const rim = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.95, 1), 1), lineMat(COLORS.magenta, 1.1, 0.55));
  group.add(rim);
  const heartGlow = [glowSprite(COLORS.magenta, 4.0, 0.22), glowSprite(COLORS.red, 8.0, 0.08)];
  for (const g of heartGlow) group.add(g);

  // shards
  const shards = [];
  for (let i = 0; i < SHARDS; i++) {
    const size = i === 0 ? 1.0 : rnd(0.45, 0.75);
    const color = palette[i % palette.length];
    const carrier = new THREE.Group(); const mesh = shardMesh(color, size); carrier.add(mesh); group.add(carrier);
    const gpos = new Float32Array(GHOST * 3), ggeo = new THREE.BufferGeometry(); ggeo.setAttribute('position', new THREE.BufferAttribute(gpos, 3));
    const ghost = new THREE.Line(ggeo, lineMat(color, 0.9, 0.3)); ghost.frustumCulled = false; group.add(ghost);
    shards.push({ carrier, mesh, ghost, f: forms(i, SHARDS), pos: new THREE.Vector3(...forms(i, SHARDS).school), prev: new THREE.Vector3(), hist: Array.from({ length: GHOST }, () => new THREE.Vector3(...forms(i, SHARDS).school)), gpos, ggeo, lag: rnd(3, 7), phase: rnd(0, TAU), wob: rnd(0.15, 0.4), roll: rnd(-1, 1), ghostTimer: rnd(0, 0.06) });
  }

  // engines: three embers at the back of the wedge
  const engines = [[-1.2, -0.3], [0, 0.4], [1.2, -0.3]].map(([x, y]) => { const e = glowSprite(COLORS.magenta, 1.3, 0.6); e.position.set(x, y, 3.2); group.add(e); return e; });

  // arcs: every orb is tethered to the heart, and to the next orb along, by a bowed line. Rebuilt each frame in ship space.
  const ARC_N = 8, ARCS = SHARDS * 2, arcPos = new Float32Array(ARCS * ARC_N * 6);
  const arcGeo = new THREE.BufferGeometry(); arcGeo.setAttribute('position', new THREE.BufferAttribute(arcPos, 3));
  const arcs = new THREE.LineSegments(arcGeo, lineMat(COLORS.magenta, 0.8, 0.28)); arcs.frustumCulled = false; group.add(arcs);
  const arcs2 = new THREE.LineSegments(arcGeo, lineMat(COLORS.violet, 0.5, 0.14)); arcs2.position.y = 0.04; arcs2.frustumCulled = false; group.add(arcs2);
  const a0 = new THREE.Vector3(), mid = new THREE.Vector3(), ctl = new THREE.Vector3(), pa = new THREE.Vector3(), pb = new THREE.Vector3();
  let arcOff = 0;
  /** write one arc from a to b, bowed sideways by `bow` along a direction away from the axis and a bit upward */
  function arc(a, b, bow, phase) {
    mid.addVectors(a, b).multiplyScalar(0.5);
    ctl.set(mid.x, mid.y, 0).normalize(); if (!Number.isFinite(ctl.x) || ctl.lengthSq() < 0.5) ctl.set(0, 1, 0);
    ctl.multiplyScalar(bow).add(mid); ctl.y += Math.sin(t * 2 + phase) * bow * 0.5;
    for (let i = 0; i < ARC_N; i++) {
      const u0 = i / ARC_N, u1 = (i + 1) / ARC_N;
      pa.copy(a).multiplyScalar((1 - u0) * (1 - u0)).addScaledVector(ctl, 2 * (1 - u0) * u0).addScaledVector(b, u0 * u0); bend.point(pa);
      pb.copy(a).multiplyScalar((1 - u1) * (1 - u1)).addScaledVector(ctl, 2 * (1 - u1) * u1).addScaledVector(b, u1 * u1); bend.point(pb);
      arcPos.set([pa.x, pa.y, pa.z, pb.x, pb.y, pb.z], arcOff); arcOff += 6;
    }
  }

  const bend = new Bender();
  const w = { school: 1, wedge: 0, comet: 0 };
  let t = 0;
  const target = new THREE.Vector3(), tmp = new THREE.Vector3();

  function update(dt, state) {
    t += dt;
    const b = state.bend; if (b) bend.set(b.trail, b.scale, b.inv, b.invQ, b.spin || 0);
    let wantWedge = clamp(state.speedFrac * 1.8 + state.thrust * 0.4, 0, 1);
    const wantComet = state.orbiting ? 0.7 : 0;
    wantWedge *= 1 - wantComet;
    const wantSchool = 1 - wantWedge - wantComet;
    const k = damp(2.4, dt);
    w.school += (wantSchool - w.school) * k; w.wedge += (wantWedge - w.wedge) * k; w.comet += (wantComet - w.comet) * k;
    const stretch = 1 + state.thrust * 0.6 + state.speedFrac * 0.5;
    const spin = t * 0.35;   // the school slowly turns as a whole

    for (let i = 0; i < shards.length; i++) {
      const s = shards[i], S = s.f.school, W = s.f.wedge, C = s.f.comet;
      // school shell rotates about Y; other forms sit still on the axis
      const sx = S[0] * Math.cos(spin) - S[2] * Math.sin(spin), sz = S[0] * Math.sin(spin) + S[2] * Math.cos(spin);
      target.set(sx * w.school + W[0] * w.wedge + C[0] * w.comet, S[1] * w.school + W[1] * w.wedge + C[1] * w.comet, sz * w.school + W[2] * w.wedge + C[2] * w.comet);
      if (target.z > 0) target.z *= 1 + (stretch - 1) * (w.wedge + w.comet);
      // living wobble, stronger in the school
      const wob = s.wob * (0.4 + 0.6 * w.school);
      target.x += Math.sin(t * 1.6 + s.phase) * wob; target.y += Math.cos(t * 1.3 + s.phase * 1.7) * wob;
      // lag toward the target: each shard has its own reaction speed, so the swarm ripples
      s.prev.copy(s.pos);
      s.pos.lerp(target, damp(s.lag, dt));
      bend.place(s.carrier, s.pos.x, s.pos.y, s.pos.z);
      // orbs live like the heart: the ember breathes, the cage tumbles, the halo twinkles on its own beat
      const op = 0.5 + 0.5 * Math.sin(t * 2.5 + s.phase);
      s.mesh.ember.scale.setScalar(0.8 + op * 0.35 + state.thrust * 0.3);
      s.mesh.cage.rotation.y += dt * 0.4 * s.roll * 2; s.mesh.cage.rotation.x += dt * 0.17;
      s.mesh.cage.material.opacity = 0.3 + 0.3 * op;
      s.mesh.halo.material.opacity = 0.1 + 0.12 * op + state.thrust * 0.1;
      // ghost trail: sample the position a few times a second, write bent points
      s.ghostTimer -= dt;
      if (s.ghostTimer <= 0) { s.ghostTimer = 0.05; s.hist.pop(); s.hist.unshift(s.pos.clone()); }
      s.hist[0].copy(s.pos);
      for (let g = 0; g < GHOST; g++) { tmp.copy(s.hist[g]); bend.point(tmp); s.gpos.set([tmp.x, tmp.y, tmp.z], g * 3); }
      s.ggeo.attributes.position.needsUpdate = true;
      s.ghost.material.opacity = 0.12 + 0.3 * (w.wedge + w.comet) * (0.5 + state.speedFrac * 0.5);
    }

    // arcs: heart to each orb, and orb to the next orb; bow more when the swarm is spread out
    arcOff = 0;
    const bow = 0.5 + 0.7 * w.school;
    for (let i = 0; i < shards.length; i++) {
      const s = shards[i], n = shards[(i + 1) % shards.length];
      arc(a0.set(0, 0, 0), s.pos, bow * 0.6, s.phase);
      arc(s.pos, n.pos, bow, s.phase + 1.3);
    }
    arcGeo.attributes.position.needsUpdate = true;
    arcs.material.opacity = 0.18 + 0.12 * (0.5 + 0.5 * Math.sin(t * 3)) + state.thrust * 0.15;

    // heart
    const pulse = 0.5 + 0.5 * Math.sin(t * 3.2);
    ember.scale.setScalar(0.8 + pulse * 0.35 + state.thrust * 0.4);
    rim.rotation.y += dt * 0.4; rim.rotation.x += dt * 0.17;
    rim.material.opacity = 0.35 + 0.35 * pulse;
    heartGlow[0].scale.setScalar(4 + pulse * 0.6 + state.thrust);
    bend.place(heart, 0, 0, 0); bend.place(ember, 0, 0, 0); bend.place(rim, 0, 0, 0); for (const g of heartGlow) bend.place(g, 0, 0, 0);
    engines.forEach((e, i) => { const [x, y] = [[-1.2, -0.3], [0, 0.4], [1.2, -0.3]][i]; bend.place(e, x * (1 - w.comet * 0.6), y, 3.2 + w.comet * 2); });
  }
  return { group, engines, update };
}
