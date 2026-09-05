// "Nautilus": a logarithmic spiral. One continuous ribbon of pearl light coils around a hot mouth in a growing spiral,
// its chambers walled by faint septa. Pearl, rose and teal, the only design that is a single curling surface.
//   Coil    - idle:   the ribbon sits coiled tight, slowly rotating, chambers glowing one after another
//   Unwind  - flight: the spiral pulls open and stretches back into a long tapering helix behind the mouth
//   Clench  - orbit:  the coil tightens and tilts, spinning faster
// The ribbon is a strip mesh rebuilt each frame from the spiral parameters. Forward is -Z.
import * as THREE from 'three';
import { COLORS } from '../config.js';
import { glowSprite } from '../materials.js';
import { TAU, rnd, damp, clamp } from '../utils.js';
import { Bender } from './bend.js';

export const id = 'nautilus';
export const name = 'Nautilus';
export const description = 'A single ribbon of pearl light coiled in a logarithmic spiral around a hot mouth. Coiled and slowly turning at rest, unwinds into a long helix in flight, clenches in orbit.';

const N = 120;          // ribbon samples along the spiral
const TURNS = 2.6;      // turns of the spiral
const SEPTA = 14;       // chamber walls
const ROSE = 0xff8fb8, PEARL = 0xfdf6ff;

export function build() {
  const group = new THREE.Group();

  // ribbon: a strip of N quads between the inner edge and outer edge of the spiral, rebuilt every frame
  const rpos = new Float32Array(N * 2 * 3), rcol = new Float32Array(N * 2 * 3), rgeo = new THREE.BufferGeometry();
  rgeo.setAttribute('position', new THREE.BufferAttribute(rpos, 3)); rgeo.setAttribute('color', new THREE.BufferAttribute(rcol, 3));
  const idx = []; for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } rgeo.setIndex(idx);
  const ribbon = new THREE.Mesh(rgeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.32, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })); ribbon.frustumCulled = false; group.add(ribbon);
  // edges: bright lines along both ribbon edges
  const edgeGeo = [0, 1].map(() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3)); return g; });
  const edges = edgeGeo.map((g, k) => { const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: new THREE.Color(k ? COLORS.green : PEARL).multiplyScalar(1.2), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })); l.frustumCulled = false; group.add(l); return l; });
  // septa: chamber walls across the ribbon at intervals
  const spos = new Float32Array(SEPTA * 6), sgeo = new THREE.BufferGeometry(); sgeo.setAttribute('position', new THREE.BufferAttribute(spos, 3));
  const septa = new THREE.LineSegments(sgeo, new THREE.LineBasicMaterial({ color: ROSE, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })); septa.frustumCulled = false; group.add(septa);
  // chamber lights: one glow per chamber, lit in sequence
  const chambers = Array.from({ length: SEPTA }, () => { const g = glowSprite(ROSE, 0.9, 0.5); group.add(g); return g; });

  // mouth: the hot opening at the spiral's outer end, where the creature would look out
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(PEARL).multiplyScalar(1.1) })); group.add(mouth);
  const mouthGlow = [glowSprite(ROSE, 3.2, 0.45), glowSprite(COLORS.green, 7, 0.12)]; for (const g of mouthGlow) group.add(g);

  // pearls: motes riding along the ribbon
  const PM = 40, ppos = new Float32Array(PM * 3), pearls = Array.from({ length: PM }, () => ({ u: Math.random(), v: rnd(0.05, 0.15), side: Math.random() }));
  const pgeo = new THREE.BufferGeometry(); pgeo.setAttribute('position', new THREE.BufferAttribute(ppos, 3));
  const pearlPts = new THREE.Points(pgeo, new THREE.PointsMaterial({ color: PEARL, size: 0.13, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); pearlPts.frustumCulled = false; group.add(pearlPts);

  const engines = [glowSprite(ROSE, 1.6, 0.6)]; group.add(engines[0]);

  const bend = new Bender();
  let t = 0, w = 0, clench = 0, roll = 0;   // w: 0 coil, 1 unwind
  const tmp = new THREE.Vector3(), inner = new THREE.Vector3(), outer = new THREE.Vector3(), c = new THREE.Color(), cRose = new THREE.Color(ROSE), cTeal = new THREE.Color(COLORS.green), cPearl = new THREE.Color(PEARL);
  const pts = Array.from({ length: N }, () => ({ i: new THREE.Vector3(), o: new THREE.Vector3() }));

  /** spiral point at parameter u (0 = centre, 1 = mouth): returns radius, angle, z, and ribbon half-width */
  function spiral(u) {
    const a = u * TAU * TURNS + roll;
    const r = 0.25 * Math.exp(u * 2.55) * (1 - clench * 0.25) * (1 - w * 0.55);    // logarithmic growth; the unwind flattens the radius
    const z = -3.2 + u * (3.2 + w * 14 + clench * 0.5);                             // coil: nearly flat; unwind: stretched far back
    const hw = 0.12 + u * 0.75 * (1 - w * 0.3);
    return { a, r, z, hw };
  }

  function update(dt, state) {
    t += dt;
    const b = state.bend; if (b) bend.set(b.trail, b.scale, b.inv, b.invQ, b.spin || 0);
    w += (clamp(state.speedFrac * 1.8 + state.thrust * 0.5, 0, 1) - w) * damp(1.8, dt);
    clench += ((state.orbiting ? 1 : 0) - clench) * damp(2, dt);
    roll += dt * (0.25 + clench * 1.2 + w * 0.6);
    const energy = 0.35 + state.speedFrac * 0.65 + state.thrust * 0.3;
    const tilt = clench * 0.6;

    // ribbon samples: inner and outer edge at each u; the mouth is at u = 1 (front, low z)
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1), s = spiral(u), rIn = Math.max(0.02, s.r - s.hw), rOut = s.r + s.hw;
      // the spiral runs from the mouth (front) inward/backward: put the mouth forward by reversing z
      const z = -s.z - 3.2 + 0.4;
      inner.set(Math.cos(s.a) * rIn, Math.sin(s.a) * rIn * (1 - tilt * 0.4), z);
      outer.set(Math.cos(s.a) * rOut, Math.sin(s.a) * rOut * (1 - tilt * 0.4), z + Math.sin(s.a) * tilt * 0.6);
      bend.point(inner); bend.point(outer);
      pts[i].i.copy(inner); pts[i].o.copy(outer);
      rpos.set([inner.x, inner.y, inner.z, outer.x, outer.y, outer.z], i * 6);
      edgeGeo[0].attributes.position.array.set([inner.x, inner.y, inner.z], i * 3); edgeGeo[1].attributes.position.array.set([outer.x, outer.y, outer.z], i * 3);
      // colour: rose at the mouth, teal deep in the coil, pearl highlights sweeping along
      const sweep = 0.5 + 0.5 * Math.sin(u * 14 - t * 3);
      c.copy(cTeal).lerp(cRose, u).lerp(cPearl, sweep * 0.35).multiplyScalar(0.6 + energy * 0.6);
      rcol.set([c.r, c.g, c.b, c.r, c.g, c.b], i * 6);
    }
    rgeo.attributes.position.needsUpdate = true; rgeo.attributes.color.needsUpdate = true;
    for (const g of edgeGeo) g.attributes.position.needsUpdate = true;
    ribbon.material.opacity = 0.22 + 0.15 * energy;
    // septa and chamber lights
    for (let k = 0; k < SEPTA; k++) {
      const i = Math.round((k + 0.5) / SEPTA * (N - 1)), p = pts[i];
      spos.set([p.i.x, p.i.y, p.i.z, p.o.x, p.o.y, p.o.z], k * 6);
      const lit = 0.5 + 0.5 * Math.sin(t * 2.2 - k * 0.7);
      chambers[k].position.lerpVectors(p.i, p.o, 0.5); chambers[k].material.opacity = 0.15 + lit * 0.6; chambers[k].scale.setScalar(0.6 + lit * 0.6 + (k / SEPTA) * 0.5);
    }
    sgeo.attributes.position.needsUpdate = true;
    // mouth at u = 1
    const m = pts[N - 1]; tmp.lerpVectors(m.i, m.o, 0.5);
    mouth.position.copy(tmp); for (const g of mouthGlow) g.position.copy(tmp);
    mouth.scale.setScalar(0.9 + 0.15 * Math.sin(t * 4) + state.thrust * 0.3); mouthGlow[0].scale.setScalar(3.2 + state.thrust * 1.2);
    // engine at the deep end of the coil
    const e = pts[0]; tmp.lerpVectors(e.i, e.o, 0.5); engines[0].position.copy(tmp);
    // pearls ride the ribbon toward the mouth
    for (let i = 0; i < PM; i++) {
      const pe = pearls[i]; pe.u = (pe.u + pe.v * dt * (1 + w * 2)) % 1;
      const k = Math.round(pe.u * (N - 1)), p = pts[k]; tmp.lerpVectors(p.i, p.o, pe.side); ppos.set([tmp.x, tmp.y, tmp.z], i * 3);
    }
    pgeo.attributes.position.needsUpdate = true;
  }
  return { group, engines, update };
}
