// "Chord": an instrument. A great bow-shaped frame with strings drawn across it; the strings hum as standing waves,
// each on its own harmonic, plucked into brighter vibration by thrust. White and gold, the only design that reads as sound.
//   Harp  - idle:   the frame stands open across the axis, strings hum softly, a slow pluck wanders along them
//   Bow   - flight: the frame swings to lie along the axis and draws taut, strings streak back as fast tight waves
//   Glissando - orbit: strings pluck in a run from low to high, the frame leans into the turn
// The frame is a rigid arc placed on the path; strings are rebuilt each frame with their waveform. Forward is -Z.
import * as THREE from 'three';
import { COLORS } from '../config.js';
import { glowSprite } from '../materials.js';
import { TAU, rnd, damp, clamp } from '../utils.js';
import { Bender } from './bend.js';

export const id = 'chord';
export const name = 'Chord';
export const description = 'A bow-shaped frame with humming strings, each a standing wave on its own harmonic. Stands open like a harp at rest, draws taut into a bow in flight, runs a glissando in orbit.';

const STRINGS = 9, SEG = 40;
const lineMat = (color, mult = 1.2, opacity = 0.8) => new THREE.LineBasicMaterial({ color: new THREE.Color(color).multiplyScalar(mult), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });

export function build() {
  const group = new THREE.Group();
  const R = 4.2;   // arc radius; the arc spans 200 degrees, its chord is the soundboard

  // frame: the arc (a thick line built from a tube) plus the straight soundboard closing it, both rigid inside one carrier
  const frame = new THREE.Group(); group.add(frame);
  const arcPts = []; for (let i = 0; i <= 48; i++) { const a = deg(-100) + deg(200) * i / 48; arcPts.push(new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, 0)); }
  frame.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arcPts), 48, 0.07, 6, false), new THREE.MeshBasicMaterial({ color: new THREE.Color(COLORS.gold).multiplyScalar(1.2), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })));
  const b0 = arcPts[0], b1 = arcPts[48];
  frame.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(b0, b1), 1, 0.05, 6, false), new THREE.MeshBasicMaterial({ color: new THREE.Color(COLORS.amber).multiplyScalar(1.1), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })));
  const pegs = []; for (const p of [b0, b1]) { const g = glowSprite(COLORS.white, 0.9, 0.9); g.position.copy(p); frame.add(g); pegs.push(g); }
  // string anchors: along the soundboard (bottom) and along the arc (top), i from 0 to STRINGS-1
  const anchors = [];
  for (let i = 0; i < STRINGS; i++) {
    const u = (i + 0.5) / STRINGS;
    const bottom = new THREE.Vector3().lerpVectors(b0, b1, u);
    const a = deg(-100) + deg(200) * u, top = new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, 0);
    anchors.push({ bottom, top });
  }
  // strings: SEG+1 samples each, rebuilt every frame
  const strings = anchors.map((an, i) => {
    const pos = new Float32Array((SEG + 1) * 3), geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const line = new THREE.Line(geo, lineMat(i % 3 === 1 ? COLORS.gold : COLORS.white, 1.1, 0.6)); line.frustumCulled = false; group.add(line);
    return { an, pos, line, harmonic: 1 + (i % 4), freq: 3 + i * 0.7, amp: 0, phase: rnd(0, TAU) };
  });
  // resonance: a soft glow at the frame centre that swells with the strings
  const core = glowSprite(COLORS.gold, 3, 0.25); group.add(core);
  const core2 = glowSprite(COLORS.white, 1.4, 0.5); group.add(core2);
  // overtones: sparks born on a plucked string, drifting off
  const SP = 50, spos = new Float32Array(SP * 3), sparks = Array.from({ length: SP }, () => ({ s: Math.floor(Math.random() * STRINGS), u: Math.random(), t: Math.random(), v: rnd(0.4, 0.9) }));
  const sgeo = new THREE.BufferGeometry(); sgeo.setAttribute('position', new THREE.BufferAttribute(spos, 3));
  const sparkPts = new THREE.Points(sgeo, new THREE.PointsMaterial({ color: COLORS.white, size: 0.11, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })); sparkPts.frustumCulled = false; group.add(sparkPts);

  const engines = [glowSprite(COLORS.gold, 1.6, 0.6)]; group.add(engines[0]);

  const bend = new Bender();
  let t = 0, w = 0, gliss = 0, pluckT = 0;   // w: 0 harp, 1 bow
  const tmp = new THREE.Vector3(), a0 = new THREE.Vector3(), a1 = new THREE.Vector3(), dir = new THREE.Vector3(), nrm = new THREE.Vector3();
  const q = new THREE.Quaternion(), qHarp = new THREE.Quaternion(), qBow = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, Math.PI / 2));
  const qLean = new THREE.Quaternion();

  function update(dt, state) {
    t += dt;
    const b = state.bend; if (b) bend.set(b.trail, b.scale, b.inv, b.invQ, b.spin || 0);
    w += (clamp(state.speedFrac * 1.8 + state.thrust * 0.5, 0, 1) - w) * damp(2, dt);
    gliss += ((state.orbiting ? 1 : 0) - gliss) * damp(2, dt);
    const energy = 0.35 + state.speedFrac * 0.65 + state.thrust * 0.3;
    // pluck: a wandering pluck at rest, a rising run in orbit, everything ringing under thrust
    pluckT += dt * (0.6 + gliss * 2.5);
    const plucked = Math.floor(pluckT) % STRINGS;
    for (const s of strings) { const idx = strings.indexOf(s); const hit = idx === plucked ? 1 : 0; s.amp += ((0.06 + hit * 0.35 + state.thrust * 0.25 + w * 0.1) - s.amp) * damp(hit ? 12 : 2.5, dt); }

    // frame orientation: harp faces forward (arc in the XY plane), bow lies along the axis; orbit leans it
    qLean.setFromEuler(new THREE.Euler(0, 0, gliss * 0.4 * Math.sin(t * 0.8)));
    q.copy(qHarp).slerp(qBow, w).multiply(qLean);
    bend.place(frame, 0, 0, 0.4 * w); frame.quaternion.multiply(q);
    const stretch = 1 + w * 0.25;   // the bow draws a little longer
    frame.scale.set(1, stretch, 1 - w * 0.15);

    // strings: anchors transformed by the frame's rotation/scale, then a standing wave along each
    for (const s of strings) {
      a0.copy(s.an.bottom).multiply(frame.scale).applyQuaternion(q); a1.copy(s.an.top).multiply(frame.scale).applyQuaternion(q);
      a0.z += 0.4 * w; a1.z += 0.4 * w;
      dir.subVectors(a1, a0); nrm.set(0, 0, 1).applyQuaternion(q);   // vibrate normal to the frame plane
      const wave = s.harmonic * (1 + w * 2);   // bow: higher partials, tighter
      for (let i = 0; i <= SEG; i++) {
        const u = i / SEG, env = Math.sin(u * Math.PI * wave) * Math.sin(t * s.freq * (1 + w * 1.5) + s.phase) * s.amp;
        tmp.copy(a0).addScaledVector(dir, u).addScaledVector(nrm, env); bend.point(tmp); s.pos.set([tmp.x, tmp.y, tmp.z], i * 3);
      }
      s.line.geometry.attributes.position.needsUpdate = true;
      s.line.material.opacity = 0.3 + s.amp * 1.4 + energy * 0.15;
    }
    // resonance glow, pegs, engine
    const ring = strings.reduce((m, s) => m + s.amp, 0) / STRINGS;
    core.scale.setScalar(3 + ring * 6 + state.thrust); core.material.opacity = 0.15 + ring * 0.8;
    core2.scale.setScalar(1.4 + ring * 2);
    bend.place(core, 0, 0, 0.4 * w); bend.place(core2, 0, 0, 0.4 * w);
    for (const p of pegs) p.material.opacity = 0.6 + ring * 0.8;
    bend.place(engines[0], 0, 0, 2.5 + w * 2.5);
    // overtones: spark at a point on a string, drift back
    for (let i = 0; i < SP; i++) {
      const sp = sparks[i]; sp.t += sp.v * dt * (0.6 + w);
      if (sp.t > 1) { sp.t = 0; sp.s = plucked; sp.u = Math.random(); }
      const s = strings[sp.s], k = Math.round(sp.u * SEG) * 3;
      tmp.set(s.pos[k], s.pos[k + 1], s.pos[k + 2] + sp.t * (1.5 + state.speedFrac * 8)); spos.set([tmp.x, tmp.y, tmp.z], i * 3);
    }
    sgeo.attributes.position.needsUpdate = true;
    sparkPts.material.opacity = 0.3 + ring * 0.8;
  }
  return { group, engines, update };
}
const deg = (d) => d / 360 * TAU;
