// "Loom": a shuttle of taut thread. Two spinning bobbin rings, fore and aft, with a ruled surface of straight threads
// strung between them. As the rings counter-rotate the threads twist into a hyperboloid with a pinched waist. Pale
// lavender and white, with a single crimson thread. The only design made of straight lines under tension.
//   Drum    - idle:   rings barely turn, threads hang as a loose open cylinder that breathes
//   Spindle - flight: rings counter-spin hard, the waist pinches to a needle and the bobbins pull apart
//   Splay   - orbit:  the aft ring flares wide, threads fan out like a skirt
// Forward is -Z.
import * as THREE from 'three';
import { COLORS } from '../config.js';
import { glowSprite } from '../materials.js';
import { TAU, rnd, damp, clamp } from '../utils.js';
import { Bender } from './bend.js';

export const id = 'loom';
export const name = 'Loom';
export const description = 'Two spinning bobbins with a hyperboloid of taut threads strung between them. Breathes as an open drum at rest, twists to a needle in flight, fans out in orbit.';

const THREADS = 36, TSEG = 10;   // threads, straight but sampled so the bend can curve them
const lineMat = (color, mult = 1.2, opacity = 0.8) => new THREE.LineBasicMaterial({ color: new THREE.Color(color).multiplyScalar(mult), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });

export function build() {
  const group = new THREE.Group();
  const R = 2.2, Z0 = -3.6, Z1 = 3.0;

  // bobbins: two rings, each a torus with a few spokes, rebuilt as rigid parts and placed on the path
  const bobbin = (color) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 6, 56), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.3), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })));
    const sp = []; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; sp.push(new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(a), Math.sin(a), 0)); }
    g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(sp), lineMat(color, 0.9, 0.35)));
    const hub = glowSprite(COLORS.white, 0.9, 0.9); g.add(hub);
    return g;
  };
  const fore = bobbin(COLORS.lav), aft = bobbin(COLORS.ice); group.add(fore, aft);
  const noseTip = glowSprite(COLORS.white, 1.3, 0.8); group.add(noseTip);

  // threads: one line each, TSEG+1 samples, rebuilt every frame from the two ring attachment points
  const threads = [];
  for (let i = 0; i < THREADS; i++) {
    const pos = new Float32Array((TSEG + 1) * 3), geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const crimson = i === 0;
    const line = new THREE.Line(geo, lineMat(crimson ? COLORS.red : i % 3 ? COLORS.lav : COLORS.white, crimson ? 1.6 : 1.0, crimson ? 0.95 : 0.45)); line.frustumCulled = false; group.add(line);
    threads.push({ pos, line, a: i / THREADS * TAU, crimson });
  }
  // shuttle: a bright bead that runs up and down the crimson thread
  const shuttle = glowSprite(COLORS.red, 0.9, 0.95); group.add(shuttle);
  let shuttleT = 0;

  // lint: fine points drifting off the threads
  const LINT = 50, lpos = new Float32Array(LINT * 3), lint = Array.from({ length: LINT }, () => ({ u: Math.random(), a: rnd(0, TAU), d: rnd(0, 0.8), v: rnd(0.1, 0.3) }));
  const lgeo = new THREE.BufferGeometry(); lgeo.setAttribute('position', new THREE.BufferAttribute(lpos, 3));
  const lintPts = new THREE.Points(lgeo, new THREE.PointsMaterial({ color: COLORS.lav, size: 0.09, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })); lintPts.frustumCulled = false; group.add(lintPts);

  const engines = [glowSprite(COLORS.lav, 1.6, 0.6)]; group.add(engines[0]);

  const bend = new Bender();
  let t = 0, w = 0, splay = 0, twist = 0;   // w: 0 drum, 1 spindle; twist: relative rotation of the aft ring
  const tmp = new THREE.Vector3(), pA = new THREE.Vector3(), pB = new THREE.Vector3();

  function update(dt, state) {
    t += dt;
    const b = state.bend; if (b) bend.set(b.trail, b.scale, b.inv, b.invQ, b.spin || 0);
    w += (clamp(state.speedFrac * 1.8 + state.thrust * 0.5, 0, 1) - w) * damp(2.2, dt);
    splay += ((state.orbiting ? 1 : 0) - splay) * damp(2, dt);
    const energy = 0.35 + state.speedFrac * 0.65 + state.thrust * 0.3;

    // ring geometry this frame: radii, z positions, relative twist
    const breathe = Math.sin(t * 0.8) * 0.12 * (1 - w);
    const rF = R * (1 - w * 0.35 + breathe), rA = R * (1 - w * 0.25 + splay * 0.9 + breathe);
    const zF = Z0 - w * 2.5, zA = Z1 + w * 1.5 + state.thrust * 0.8;
    // the target twist: a loose quarter turn at rest, a near half turn in flight (the pinch), unwound a little by the splay
    const wantTwist = 0.5 + w * 2.2 - splay * 0.3;
    twist += (wantTwist - twist) * damp(3, dt);
    const spinF = t * (0.3 + w * 3) * energy, spinA = -t * (0.3 + w * 3) * energy + twist;   // rings counter-rotate; the aft carries the twist

    bend.place(fore, 0, 0, zF); fore.scale.setScalar(rF); fore.rotation.z = spinF;
    bend.place(aft, 0, 0, zA); aft.scale.setScalar(rA); aft.rotation.z = spinA;
    bend.place(noseTip, 0, 0, zF - 1.2); noseTip.material.opacity = 0.4 + 0.5 * w;
    bend.place(engines[0], 0, 0, zA + 0.6);

    // threads: straight from fore attachment to aft attachment (a ruled surface), sampled so they follow the bend
    for (const th of threads) {
      pA.set(Math.cos(th.a + spinF) * rF, Math.sin(th.a + spinF) * rF, zF);
      pB.set(Math.cos(th.a + spinA) * rA, Math.sin(th.a + spinA) * rA, zA);
      for (let k = 0; k <= TSEG; k++) { tmp.lerpVectors(pA, pB, k / TSEG); bend.point(tmp); th.pos.set([tmp.x, tmp.y, tmp.z], k * 3); }
      th.line.geometry.attributes.position.needsUpdate = true;
      if (!th.crimson) th.line.material.opacity = 0.3 + 0.3 * energy + 0.1 * Math.sin(t * 3 + th.a * 2);
    }
    // shuttle runs the crimson thread
    shuttleT = (shuttleT + dt * (0.5 + w * 1.5)) % 2; const su = shuttleT < 1 ? shuttleT : 2 - shuttleT;
    const cr = threads[0]; pA.set(Math.cos(cr.a + spinF) * rF, Math.sin(cr.a + spinF) * rF, zF); pB.set(Math.cos(cr.a + spinA) * rA, Math.sin(cr.a + spinA) * rA, zA);
    tmp.lerpVectors(pA, pB, su); bend.point(tmp); shuttle.position.copy(tmp);

    // lint: sits just outside the thread surface, slides aft
    for (let i = 0; i < LINT; i++) {
      const l = lint[i]; l.u = (l.u + l.v * dt * (0.5 + w * 2)) % 1;
      const a = l.a + spinF + (spinA - spinF) * l.u, r = rF + (rA - rF) * l.u + 0.2 + l.d * (1 - w);
      tmp.set(Math.cos(a) * r, Math.sin(a) * r, zF + (zA - zF) * l.u + l.d * w * 3); bend.point(tmp); lpos.set([tmp.x, tmp.y, tmp.z], i * 3);
    }
    lgeo.attributes.position.needsUpdate = true;
  }
  return { group, engines, update };
}
