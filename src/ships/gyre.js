// "Gyre": an armillary sphere. A white-hot pinpoint core caged in five nested gimbal rings, each on its own axis,
// each carrying beads that race around it. Deep blue and white with one hot red bead per ring.
//   Armillary - idle:   rings tilt every which way and tumble slowly around the core, an astronomer's instrument
//   Coil      - flight: rings swing to face forward and slide apart along the axis into a stacked tube, spinning fast
//   Precess   - orbit:  the coil leans and wobbles like a spun top losing its footing
// Rings are rigid tori placed on the flight path; orientation is a slerp between the tumbling armillary pose and the
// forward-facing coil pose. Forward is -Z.
import * as THREE from 'three';
import { COLORS } from '../config.js';
import { glowSprite } from '../materials.js';
import { TAU, rnd, damp, clamp } from '../utils.js';
import { Bender } from './bend.js';

export const id = 'gyre';
export const name = 'Gyre';
export const description = 'An armillary sphere: nested gimbal rings tumbling around a pinpoint core. Slides apart into a spinning coil in flight, precesses like a top in orbit.';

const RINGS = 5, BEADS = 6;
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _id = new THREE.Quaternion();

export function build() {
  const group = new THREE.Group();

  // core: a pinpoint, harder and smaller than the other vessels', with a wide cold glow
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(COLORS.white).multiplyScalar(1.2) }));
  group.add(core);
  const coreGlow = [glowSprite(COLORS.white, 1.6, 0.6), glowSprite(COLORS.blue, 5.5, 0.22), glowSprite(COLORS.nebula, 12, 0.07)];
  for (const g of coreGlow) group.add(g);

  // rings: carrier (placed on the path) > gimbal (orientation) > torus (spins) with beads and a diameter bar as children
  const rings = [];
  for (let i = 0; i < RINGS; i++) {
    const r = 1.3 + i * 0.65;
    const carrier = new THREE.Group(), gimbal = new THREE.Group(); carrier.add(gimbal); group.add(carrier);
    const torus = new THREE.Mesh(new THREE.TorusGeometry(r, 0.035 + i * 0.008, 6, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(i % 2 ? COLORS.blue : COLORS.ice).multiplyScalar(1.3), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    gimbal.add(torus);
    // a faint diameter bar across the ring, so the gimbal axis reads
    const bar = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-r, 0, 0), new THREE.Vector3(r, 0, 0)]), new THREE.LineBasicMaterial({ color: COLORS.blue, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
    torus.add(bar);
    // beads race around the ring; one per ring runs hot red
    const beads = [];
    for (let k = 0; k < BEADS; k++) {
      const hot = k === 0;
      const bd = glowSprite(hot ? COLORS.red : COLORS.white, hot ? 0.9 : 0.5, hot ? 0.95 : 0.8);
      torus.add(bd); beads.push({ s: bd, a: k / BEADS * TAU, v: rnd(0.8, 1.6) * (i % 2 ? 1 : -1) });
    }
    rings.push({ r, carrier, gimbal, torus, beads, tiltX: rnd(-1.2, 1.2), tiltZ: rnd(-1.2, 1.2), tumble: rnd(0.15, 0.4) * (i % 2 ? 1 : -1), spin: rnd(0.6, 1.2) * (i % 2 ? -1 : 1), phase: rnd(0, TAU) });
  }

  // sand: a fine wake of points falling back from the core, thrown wider by the spinning rings
  const SAND = 110, spos = new Float32Array(SAND * 3), sand = Array.from({ length: SAND }, () => ({ t: Math.random(), a: rnd(0, TAU), r: rnd(0.2, 1.4), v: rnd(0.3, 0.8) }));
  const sgeo = new THREE.BufferGeometry(); sgeo.setAttribute('position', new THREE.BufferAttribute(spos, 3));
  const sandPts = new THREE.Points(sgeo, new THREE.PointsMaterial({ color: new THREE.Color(COLORS.ice).multiplyScalar(1.1), size: 0.1, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })); sandPts.frustumCulled = false; group.add(sandPts);

  // engines: the rearmost ring's glow
  const engines = [glowSprite(COLORS.blue, 1.8, 0.6)]; group.add(engines[0]);

  const bend = new Bender();
  let t = 0, w = 0, lean = 0;   // w: 0 armillary, 1 coil
  const tmp = new THREE.Vector3();

  function update(dt, state) {
    t += dt;
    const b = state.bend; if (b) bend.set(b.trail, b.scale, b.inv, b.invQ, b.spin || 0);
    w += (clamp(state.speedFrac * 2 + state.thrust * 0.5, 0, 1) - w) * damp(2.4, dt);
    lean += ((state.orbiting ? 1 : 0) - lean) * damp(2, dt);
    const energy = 0.35 + state.speedFrac * 0.65 + state.thrust * 0.3;
    const wob = lean * 0.35;   // precession: the whole coil nods on a slow circle

    for (let i = 0; i < RINGS; i++) {
      const R = rings[i];
      // where on the axis: all at the core in the armillary, spread into a tube in the coil (front rings small, rear rings large)
      const z = (-2.2 + i * 1.5) * w;
      bend.place(R.carrier, 0, 0, z);
      // orientation: tumbling tilt at rest, forward-facing in flight, plus precession while orbiting
      _e.set(R.tiltX + Math.sin(t * R.tumble + R.phase) * 0.6, t * R.tumble * 1.3 + R.phase, R.tiltZ);
      _q.setFromEuler(_e);
      _e.set(Math.sin(t * 1.6 + i * 0.5) * wob, Math.cos(t * 1.6 + i * 0.5) * wob, 0); _id.setFromEuler(_e);
      R.gimbal.quaternion.copy(_q).slerp(_id, w);
      // spin the ring on its own axis, faster in flight; the coil counter-rotates ring to ring
      R.torus.rotation.z += dt * R.spin * (0.6 + w * 3.5) * energy;
      // coil squeezes the radii toward a tube: front rings shrink, rear rings hold
      const squeeze = 1 - w * 0.35 * (1 - i / (RINGS - 1));
      R.torus.scale.setScalar(squeeze + 0.03 * Math.sin(t * 3 + i));
      R.torus.material.opacity = 0.55 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2.5 + R.phase)) * energy;
      for (const bd of R.beads) { bd.a += bd.v * dt * (1 + w * 2.5) * energy; bd.s.position.set(Math.cos(bd.a) * R.r, Math.sin(bd.a) * R.r, 0); }
    }

    // core
    const pulse = 0.5 + 0.5 * Math.sin(t * 7);
    core.scale.setScalar(0.9 + pulse * 0.25 + state.thrust * 0.3);
    coreGlow[0].scale.setScalar(1.6 + pulse * 0.4 + state.thrust * 0.6);
    coreGlow[1].scale.setScalar(5.5 + w * 2 + state.thrust);
    bend.place(core, 0, 0, 0); for (const g of coreGlow) bend.place(g, 0, 0, 0);
    bend.place(engines[0], 0, 0, 3.8 * w + 1.2);

    // sand: streams back from the core; in the coil it spirals down the tube
    const back = 3 + state.speedFrac * 10 + w * 3;
    for (let i = 0; i < SAND; i++) {
      const s = sand[i]; s.t = (s.t + s.v * dt * (0.5 + state.speedFrac)) % 1;
      const a = s.a + s.t * TAU * 1.5 * w, r = s.r * (1 + s.t * 1.5) * (1 - w * 0.4);
      tmp.set(Math.cos(a) * r, Math.sin(a) * r, s.t * back); bend.point(tmp); spos.set([tmp.x, tmp.y, tmp.z], i * 3);
    }
    sgeo.attributes.position.needsUpdate = true;
    sandPts.material.opacity = 0.25 + 0.5 * state.speedFrac;
  }
  return { group, engines, update };
}
