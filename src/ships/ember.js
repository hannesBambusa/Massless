// "Ember": a cinder in flight. A jagged dark nucleus that smoulders, wrapped in layered smoke and licked by tongues of
// flame streaming back. The only design that reads as fire: red, orange, amber, with a white-hot crack through the stone.
//   Smoulder - idle:   flames flicker short and upward, sparks drift up and out, smoke hangs
//   Streak   - flight: flames stretch into a long trail, smoke is blown back into a plume, sparks stream
//   Whirl    - orbit:  the flames twist into a spiral around the nucleus
// Forward is -Z.
import * as THREE from 'three';
import { COLORS } from '../config.js';
import { glowSprite } from '../materials.js';
import { TAU, rnd, damp, clamp } from '../utils.js';
import { Bender } from './bend.js';

export const id = 'ember';
export const name = 'Ember';
export const description = 'A smouldering cinder wrapped in smoke, licked by tongues of flame. Flickers at rest, streaks into a fire trail in flight, whirls into a spiral in orbit.';

const FLAMES = 12, FCTRL = 5, FSAMPLES = 18, SPARKS = 80, SMOKE = 14;
const flameColors = [COLORS.red, COLORS.orange, COLORS.amber, COLORS.gold];

export function build() {
  const group = new THREE.Group();

  // nucleus: a jagged dark stone (noisy icosahedron) with glowing cracks (its edges) and a hot core showing through
  const rockGeo = new THREE.IcosahedronGeometry(1.1, 1); const pa = rockGeo.attributes.position;
  for (let i = 0; i < pa.count; i++) { const k = rnd(0.75, 1.25); pa.setXYZ(i, pa.getX(i) * k, pa.getY(i) * k * 0.85, pa.getZ(i) * k * 1.3); }
  rockGeo.computeVertexNormals();
  const rock = new THREE.Mesh(rockGeo, new THREE.MeshBasicMaterial({ color: 0x140806 })); group.add(rock);
  const cracks = new THREE.LineSegments(new THREE.EdgesGeometry(rockGeo, 1), new THREE.LineBasicMaterial({ color: new THREE.Color(COLORS.orange).multiplyScalar(1.5), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false })); group.add(cracks);
  const heat = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(COLORS.white).multiplyScalar(1.2) })); group.add(heat);
  const coreGlow = [glowSprite(COLORS.orange, 3.2, 0.5), glowSprite(COLORS.red, 7, 0.16)]; for (const g of coreGlow) group.add(g);

  // smoke: soft dark-red sprites drifting behind, layered so they read as a cloud
  const smoke = Array.from({ length: SMOKE }, (_, i) => { const s = glowSprite(i % 3 ? 0x5a1a1a : 0x3a1010, rnd(2, 4), 0.35); s.userData = { t: Math.random(), a: rnd(0, TAU), r: rnd(0.3, 1.3), v: rnd(0.25, 0.5) }; group.add(s); return s; });

  // flames: curves from the nucleus surface backward, each a Catmull-Rom with animated control points
  const flames = [];
  for (let i = 0; i < FLAMES; i++) {
    const a = i / FLAMES * TAU + rnd(-0.2, 0.2), r0 = rnd(0.5, 0.9);
    const pos = new Float32Array(FSAMPLES * 3), geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: new THREE.Color(flameColors[i % flameColors.length]).multiplyScalar(1.4), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })); line.frustumCulled = false; group.add(line);
    flames.push({ a, r0, pos, line, len: rnd(2.2, 3.6), phase: rnd(0, TAU), speed: rnd(2, 4), curve: new THREE.CatmullRomCurve3(Array.from({ length: FCTRL }, () => new THREE.Vector3()), false, 'catmullrom', 0.5) });
  }

  // sparks: points thrown off the flames
  const spos = new Float32Array(SPARKS * 3), scol = new Float32Array(SPARKS * 3), sparks = [];
  const c = new THREE.Color();
  for (let i = 0; i < SPARKS; i++) { sparks.push({ t: Math.random(), a: rnd(0, TAU), r: rnd(0.4, 1.6), v: rnd(0.4, 1.1), up: rnd(0.4, 1.4) }); c.set(flameColors[i % 4]).multiplyScalar(rnd(0.9, 1.4)); scol.set([c.r, c.g, c.b], i * 3); }
  const sgeo = new THREE.BufferGeometry(); sgeo.setAttribute('position', new THREE.BufferAttribute(spos, 3)); sgeo.setAttribute('color', new THREE.BufferAttribute(scol, 3));
  const sparkPts = new THREE.Points(sgeo, new THREE.PointsMaterial({ size: 0.13, vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); sparkPts.frustumCulled = false; group.add(sparkPts);

  const engines = [glowSprite(COLORS.orange, 1.6, 0.6)]; engines[0].position.z = 1.6; group.add(engines[0]);

  const bend = new Bender();
  let t = 0, w = 0, whirl = 0;   // w: 0 smoulder, 1 streak
  const tmp = new THREE.Vector3();

  function update(dt, state) {
    t += dt;
    const b = state.bend; if (b) bend.set(b.trail, b.scale, b.inv, b.invQ, b.spin || 0);
    w += (clamp(state.speedFrac * 1.8 + state.thrust * 0.5, 0, 1) - w) * damp(2.5, dt);
    whirl += ((state.orbiting ? 1 : 0) - whirl) * damp(2, dt);
    const heatK = 0.4 + state.thrust * 0.6 + state.speedFrac * 0.3;

    // nucleus: slow tumble at rest, locked and glowing hotter in flight
    rock.rotation.x += dt * 0.25 * (1 - w * 0.8); rock.rotation.y += dt * 0.17 * (1 - w * 0.8); cracks.rotation.copy(rock.rotation);
    bend.place(rock, 0, 0, 0); bend.place(cracks, 0, 0, 0); bend.place(heat, 0, 0, 0); for (const g of coreGlow) bend.place(g, 0, 0, 0);
    const flick = 0.5 + 0.5 * Math.sin(t * 9) * Math.sin(t * 5.3);
    cracks.material.opacity = 0.4 + 0.4 * flick + w * 0.3;
    heat.scale.setScalar(0.85 + flick * 0.2 + state.thrust * 0.3);
    coreGlow[0].scale.setScalar(3.2 + flick * 0.5 + state.thrust);
    bend.place(engines[0], 0, 0, 1.6 + w * 2);

    // flames: each licks back from the surface; at rest they curl upward (+Y) and stay short, in flight they stretch back
    const stretch = 1 + w * 3.5 + state.thrust * 1.5;
    for (const f of flames) {
      const pts = f.curve.points, twist = whirl * 2.2;
      for (let k = 0; k < FCTRL; k++) {
        const u = k / (FCTRL - 1), a = f.a + u * twist + Math.sin(t * f.speed + f.phase + u * 3) * 0.25 * (1 - w * 0.6);
        const r = f.r0 + u * (0.8 - w * 0.5) + Math.sin(t * f.speed * 1.4 + f.phase) * 0.2 * u;
        const lift = (1 - w) * u * u * 1.6;    // smoulder: flames rise
        pts[k].set(Math.cos(a) * r, Math.sin(a) * r + lift, u * f.len * stretch * (0.35 + w * 0.65));
      }
      f.curve.updateArcLengths();
      for (let i = 0; i < FSAMPLES; i++) { f.curve.getPoint(i / (FSAMPLES - 1), tmp); bend.point(tmp); f.pos.set([tmp.x, tmp.y, tmp.z], i * 3); }
      f.line.geometry.attributes.position.needsUpdate = true;
      f.line.material.opacity = 0.45 + 0.45 * (0.5 + 0.5 * Math.sin(t * f.speed * 2 + f.phase)) * heatK;
    }

    // smoke: hangs around the stone at rest, blown into a plume behind in flight
    for (const s of smoke) {
      const u = s.userData; u.t = (u.t + u.v * dt * (0.6 + w)) % 1;
      const r = u.r * (1 + u.t * 1.8), a = u.a + t * 0.2;
      tmp.set(Math.cos(a) * r, Math.sin(a) * r * 0.7 + (1 - w) * u.t * 1.5, u.t * (2.5 + w * 8) - 0.5); bend.point(tmp); s.position.copy(tmp);
      s.material.opacity = 0.32 * (1 - u.t) * (0.6 + w * 0.4); s.scale.setScalar(2 + u.t * 3);
    }

    // sparks: rise at rest, stream back in flight
    for (let i = 0; i < SPARKS; i++) {
      const s = sparks[i]; s.t = (s.t + s.v * dt * (0.7 + w * 1.5)) % 1;
      const a = s.a + s.t * whirl * 4 + t * 0.3, r = s.r * (1 + s.t);
      tmp.set(Math.cos(a) * r, Math.sin(a) * r + (1 - w) * s.t * s.up * 2.5, s.t * (1.5 + w * 12)); bend.point(tmp); spos.set([tmp.x, tmp.y, tmp.z], i * 3);
    }
    sgeo.attributes.position.needsUpdate = true;
    sparkPts.material.opacity = 0.5 + 0.4 * heatK;
  }
  return { group, engines, update };
}
