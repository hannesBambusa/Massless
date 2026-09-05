// "Medusa": a deep-sea jelly. A translucent wire bell that pulses, a knot of light inside it, and long trailing
// tentacles that ripple in its wake. Ice, sky and white with a warm gold gut. The only design that swims.
//   Drift  - idle:   slow, deep pulses; tentacles hang loose and spread wide behind the bell
//   Jet    - flight: slightly quicker, shallow pulses, the bell narrows, tentacles trail straight and long
//   Curl   - orbit:  tentacles curl inward toward the target side, the bell leans
// The bell is a lat/long line mesh rebuilt each frame (pulse changes its profile), tentacles are Catmull-Rom curves. Forward is -Z.
import * as THREE from 'three';
import { COLORS } from '../config.js';
import { glowSprite } from '../materials.js';
import { TAU, rnd, damp, clamp } from '../utils.js';
import { Bender } from './bend.js';

export const id = 'medusa';
export const name = 'Medusa';
export const description = 'A pulsing wire bell with a knot of light inside and long rippling tentacles. Drifts with slow smooth pulses at rest, narrows and trails long in flight, curls in orbit.';

const LAT = 7, LON = 16;         // bell rings and meridians
const TENT = 10, TCTRL = 6, TSAMP = 24;
const lineMat = (color, mult = 1.2, opacity = 0.8) => new THREE.LineBasicMaterial({ color: new THREE.Color(color).multiplyScalar(mult), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });

export function build() {
  const group = new THREE.Group();
  const BELL_R = 2.8, BELL_H = 3.2;

  // bell: LAT rings (line loops) and LON meridians (lines), all rebuilt each frame
  const rings = Array.from({ length: LAT }, (_, i) => { const pos = new Float32Array((LON + 1) * 3), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const l = new THREE.Line(g, lineMat(i === LAT - 1 ? COLORS.white : COLORS.ice, 1.1, i === LAT - 1 ? 0.9 : 0.45)); l.frustumCulled = false; group.add(l); return { pos, l }; });
  const merids = Array.from({ length: LON }, () => { const pos = new Float32Array(LAT * 3), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const l = new THREE.Line(g, lineMat(COLORS.sky, 1.0, 0.35)); l.frustumCulled = false; group.add(l); return { pos, l }; });
  // membrane: a faint additive skin over the bell, same lat/long grid as triangles
  const skinGeo = new THREE.BufferGeometry(); const skinPos = new Float32Array(LAT * (LON + 1) * 3); skinGeo.setAttribute('position', new THREE.BufferAttribute(skinPos, 3));
  const idx = []; for (let i = 0; i < LAT - 1; i++) for (let j = 0; j < LON; j++) { const a = i * (LON + 1) + j, b2 = a + LON + 1; idx.push(a, b2, a + 1, a + 1, b2, b2 + 1); } skinGeo.setIndex(idx);
  const skin = new THREE.Mesh(skinGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(COLORS.sky).multiplyScalar(0.8), transparent: true, opacity: 0.08, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })); skin.frustumCulled = false; group.add(skin);

  // gut: a warm knot of light inside the bell, with a few orbiting grains
  const gut = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(COLORS.gold).multiplyScalar(1.3) })); group.add(gut);
  const gutGlow = [glowSprite(COLORS.gold, 2.6, 0.5), glowSprite(COLORS.sky, 6.5, 0.16)]; for (const g of gutGlow) group.add(g);
  const grains = Array.from({ length: 5 }, (_, i) => { const s = glowSprite(COLORS.amber, 0.5, 0.9); group.add(s); return { s, a: i / 5 * TAU, r: rnd(0.7, 1.1), w: rnd(1, 2) }; });

  // tentacles: from the bell rim backward
  const tents = [];
  for (let i = 0; i < TENT; i++) {
    const a = i / TENT * TAU, pos = new Float32Array(TSAMP * 3), geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const line = new THREE.Line(geo, lineMat(i % 3 ? COLORS.ice : COLORS.white, 1.1, 0.7)); line.frustumCulled = false; group.add(line);
    tents.push({ a, pos, line, len: rnd(6, 9), phase: rnd(0, TAU), speed: rnd(1.2, 2), curve: new THREE.CatmullRomCurve3(Array.from({ length: TCTRL }, () => new THREE.Vector3()), false, 'catmullrom', 0.5) });
  }
  // tentacle tips glow
  const tips = tents.map(() => { const s = glowSprite(COLORS.sky, 0.6, 0.8); group.add(s); return s; });

  const engines = [glowSprite(COLORS.sky, 1.8, 0.5)]; group.add(engines[0]);

  const bend = new Bender();
  let t = 0, w = 0, curl = 0, beat = 0, pulse = 0;   // w: 0 drift, 1 jet
  const tmp = new THREE.Vector3();

  function update(dt, state) {
    t += dt;
    const b = state.bend; if (b) bend.set(b.trail, b.scale, b.inv, b.invQ, b.spin || 0);
    w += (clamp(state.speedFrac * 1.8 + state.thrust * 0.5, 0, 1) - w) * damp(2.2, dt);
    curl += ((state.orbiting ? 1 : 0) - curl) * damp(2, dt);
    // heartbeat: a smooth sine, slow at rest and only a little quicker in flight; the target pulse is eased so nothing snaps
    beat += dt * (0.35 + w * 0.35 + state.thrust * 0.15);
    const wantPulse = 0.5 - 0.5 * Math.cos(beat * TAU);   // 0 open, 1 contracted
    pulse += (wantPulse - pulse) * damp(4, dt);
    const contract = pulse * (0.16 + w * 0.08);

    // bell profile: rings from apex (i=0) to rim (i=LAT-1); contraction narrows the rim and lengthens the bell
    const rBell = BELL_R * (1 - contract - w * 0.25), hBell = BELL_H * (1 + contract * 0.6 + w * 0.35);
    const APEX = -hBell * 0.55;
    let rimR = 0, rimZ = 0;
    for (let i = 0; i < LAT; i++) {
      const u = i / (LAT - 1), r = rBell * Math.sin(u * Math.PI * 0.62), z = APEX + hBell * u * (0.85 + 0.15 * u);
      if (i === LAT - 1) { rimR = r; rimZ = z; }
      for (let j = 0; j <= LON; j++) {
        const a = j / LON * TAU, lean = curl * 0.3 * Math.cos(a) * u;
        tmp.set(Math.cos(a) * r, Math.sin(a) * r + lean, z + Math.sin(a * 4 + t * 2) * 0.05 * u); bend.point(tmp);
        rings[i].pos.set([tmp.x, tmp.y, tmp.z], j * 3); skinPos.set([tmp.x, tmp.y, tmp.z], (i * (LON + 1) + j) * 3);
        if (j < LON) merids[j].pos.set([tmp.x, tmp.y, tmp.z], i * 3);
      }
      rings[i].l.geometry.attributes.position.needsUpdate = true;
      rings[i].l.material.opacity = (i === LAT - 1 ? 0.6 : 0.25) + 0.35 * pulse;
    }
    for (const m of merids) m.l.geometry.attributes.position.needsUpdate = true;
    skinGeo.attributes.position.needsUpdate = true; skin.material.opacity = 0.05 + 0.07 * pulse;

    // gut and grains
    const GZ = APEX + hBell * 0.45;
    bend.place(gut, 0, 0, GZ); for (const g of gutGlow) bend.place(g, 0, 0, GZ);
    gut.scale.setScalar(0.9 + pulse * 0.3); gutGlow[0].scale.setScalar(2.6 + pulse * 0.8 + state.thrust * 0.6);
    for (const g of grains) { g.a += g.w * dt * (1 + w); bend.place(g.s, Math.cos(g.a) * g.r, Math.sin(g.a) * g.r * 0.6, GZ + Math.sin(g.a * 2) * 0.3); }
    bend.place(engines[0], 0, 0, rimZ + 0.3); engines[0].material.opacity = 0.2 + pulse * 0.6 * (0.4 + w);

    // tentacles: hang from the rim; drift spreads them wide and lets them sway, jet trails them straight, curl draws them to one side
    for (let i = 0; i < TENT; i++) {
      const te = tents[i], pts = te.curve.points;
      const rootR = rimR * 0.95, cx = Math.cos(te.a), sy = Math.sin(te.a);
      for (let k = 0; k < TCTRL; k++) {
        const u = k / (TCTRL - 1);
        const spread = 1 + u * (1.4 * (1 - w) - 0.5 * w);                                  // drift: flare out; jet: converge
        const sway = Math.sin(t * te.speed + te.phase + u * 4) * 0.5 * u * (1 - w * 0.5);
        const pull = curl * u * u * 2.2;                                                    // curl: drag toward +X (the target side)
        pts[k].set(cx * rootR * spread + sway + pull, sy * rootR * spread + Math.cos(t * te.speed * 0.8 + te.phase + u * 3) * 0.4 * u, rimZ + u * te.len * (0.6 + w * 0.8 + state.thrust * 0.3));
      }
      te.curve.updateArcLengths();
      for (let s = 0; s < TSAMP; s++) { te.curve.getPoint(s / (TSAMP - 1), tmp); bend.point(tmp); te.pos.set([tmp.x, tmp.y, tmp.z], s * 3); }
      te.line.geometry.attributes.position.needsUpdate = true;
      te.line.material.opacity = 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(t * te.speed * 1.5 + te.phase - 2)) + pulse * 0.2;
      tips[i].position.set(te.pos[(TSAMP - 1) * 3], te.pos[(TSAMP - 1) * 3 + 1], te.pos[(TSAMP - 1) * 3 + 2]);
      tips[i].material.opacity = 0.4 + 0.5 * Math.sin(t * 3 + te.phase) * 0.5 + 0.2;
    }
  }
  return { group, engines, update };
}
