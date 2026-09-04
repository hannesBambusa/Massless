// "Shoal": no hull at all, a school of angular shards swimming around a dark heart. Magenta and ember tones, unlike the
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
export const description = 'A school of angular shards circling a dark heart. Drifts as a shell at rest, locks into stacked chevrons in flight, streams into a comet tail in orbit.';

const SHARDS = 36;
const GHOST = 7;                // trail points per shard
const palette = [COLORS.magenta, COLORS.violet, COLORS.red, COLORS.orange, COLORS.white];
const lineMat = (color, mult = 1.3, opacity = 0.9) => new THREE.LineBasicMaterial({ color: new THREE.Color(color).multiplyScalar(mult), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });

/** one shard: a slim dart, dark fill and a bright edge, pointing -Z */
function shardMesh(color, size) {
  const g = new THREE.Group();
  const shape = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, -size * 1.6), new THREE.Vector3(-size * 0.55, 0, size * 0.5), new THREE.Vector3(0, size * 0.18, size * 0.2), new THREE.Vector3(size * 0.55, 0, size * 0.5)]);
  shape.setIndex([0, 1, 2, 0, 2, 3, 1, 3, 2]);
  g.add(new THREE.Mesh(shape, new THREE.MeshBasicMaterial({ color: COLORS.hull, side: THREE.DoubleSide })));
  g.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, -size * 1.6), new THREE.Vector3(-size * 0.55, 0, size * 0.5), new THREE.Vector3(0, size * 0.18, size * 0.2), new THREE.Vector3(size * 0.55, 0, size * 0.5)]), lineMat(color)));
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
    const size = i === 0 ? 0.9 : rnd(0.35, 0.65);
    const color = palette[i % palette.length];
    const carrier = new THREE.Group(); const mesh = shardMesh(color, size); carrier.add(mesh); group.add(carrier);
    const gpos = new Float32Array(GHOST * 3), ggeo = new THREE.BufferGeometry(); ggeo.setAttribute('position', new THREE.BufferAttribute(gpos, 3));
    const ghost = new THREE.Line(ggeo, lineMat(color, 0.9, 0.3)); ghost.frustumCulled = false; group.add(ghost);
    shards.push({ carrier, mesh, ghost, f: forms(i, SHARDS), pos: new THREE.Vector3(...forms(i, SHARDS).school), prev: new THREE.Vector3(), hist: Array.from({ length: GHOST }, () => new THREE.Vector3(...forms(i, SHARDS).school)), gpos, ggeo, lag: rnd(3, 7), phase: rnd(0, TAU), wob: rnd(0.15, 0.4), roll: rnd(-1, 1), ghostTimer: rnd(0, 0.06) });
  }

  // engines: three embers at the back of the wedge
  const engines = [[-1.2, -0.3], [0, 0.4], [1.2, -0.3]].map(([x, y]) => { const e = glowSprite(COLORS.magenta, 1.3, 0.6); e.position.set(x, y, 3.2); group.add(e); return e; });

  const bend = new Bender();
  const w = { school: 1, wedge: 0, comet: 0 };
  let t = 0;
  const target = new THREE.Vector3(), dir = new THREE.Vector3(), tmp = new THREE.Vector3(), m = new THREE.Matrix4(), q = new THREE.Quaternion();
  const UP = new THREE.Vector3(0, 1, 0);

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
      // heading: face the way this shard is moving, falling back to forward when still
      dir.subVectors(s.pos, s.prev);
      if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1); else dir.normalize();
      dir.lerp(tmp.set(0, 0, -1), w.wedge * 0.85).normalize();     // in the wedge everyone points forward
      m.lookAt(tmp.set(0, 0, 0), dir, UP); q.setFromRotationMatrix(m);
      s.mesh.quaternion.slerp(q, damp(8, dt));
      s.mesh.rotateZ(s.roll * dt * w.school * 0.8);
      // ghost trail: sample the position a few times a second, write bent points
      s.ghostTimer -= dt;
      if (s.ghostTimer <= 0) { s.ghostTimer = 0.05; s.hist.pop(); s.hist.unshift(s.pos.clone()); }
      s.hist[0].copy(s.pos);
      for (let g = 0; g < GHOST; g++) { tmp.copy(s.hist[g]); bend.point(tmp); s.gpos.set([tmp.x, tmp.y, tmp.z], g * 3); }
      s.ggeo.attributes.position.needsUpdate = true;
      s.ghost.material.opacity = 0.12 + 0.3 * (w.wedge + w.comet) * (0.5 + state.speedFrac * 0.5);
    }

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
