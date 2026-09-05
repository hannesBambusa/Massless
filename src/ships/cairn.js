// "Cairn": a stack of floating stone slabs. Dark flat tablets hover in a column, each engraved with glowing violet glyph
// lines, held apart by nothing. The only design made of heavy flat plates.
//   Stack   - idle:   slabs hover in a loose column, each slowly turning against its neighbours, glyphs pulsing in sequence
//   Shingle - flight: slabs slide back and tilt into a staggered arrowhead, overlapping like roof tiles
//   Mill    - orbit:  slabs swing out and wheel around the axis like a slow turbine
// Slabs are rigid parts placed on the flight path. Forward is -Z.
import * as THREE from 'three';
import { COLORS } from '../config.js';
import { glowSprite, glowLineMat } from '../materials.js';
import { TAU, rnd, damp, clamp } from '../utils.js';
import { Bender } from './bend.js';

export const id = 'cairn';
export const name = 'Cairn';
export const description = 'A column of floating stone slabs engraved with glowing glyphs. Hovers as a stack at rest, shingles into an arrowhead in flight, wheels like a mill in orbit.';

const SLABS = 7;
const lineMat = glowLineMat;

/** glyph lines carved into a slab face: a few random right-angled strokes within the slab's w x h */
function glyphs(w, h) {
  const pts = [], n = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    let x = rnd(-w * 0.4, w * 0.4), y = rnd(-h * 0.4, h * 0.4);
    for (let k = 0; k < 3; k++) { const nx = k % 2 ? x : clamp(x + rnd(-w * 0.35, w * 0.35), -w * 0.45, w * 0.45), ny = k % 2 ? clamp(y + rnd(-h * 0.35, h * 0.35), -h * 0.45, h * 0.45) : y; pts.push(new THREE.Vector3(x, y, 0.06), new THREE.Vector3(nx, ny, 0.06)); x = nx; y = ny; }
  }
  return pts;
}

export function build() {
  const group = new THREE.Group();

  // keystone: a small bright core the slabs are stacked around
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(COLORS.white).multiplyScalar(1.1) })); group.add(core);
  const coreGlow = [glowSprite(COLORS.violet, 3.5, 0.4), glowSprite(COLORS.lav, 8, 0.12)]; for (const g of coreGlow) group.add(g);

  // slabs: thin boxes, dark fill, faint edge, glyph lines on both faces
  const slabs = [];
  for (let i = 0; i < SLABS; i++) {
    const big = 1 - Math.abs(i - (SLABS - 1) / 2) / ((SLABS - 1) / 2) * 0.45;   // biggest in the middle of the stack
    const w = 3.2 * big, h = 2.0 * big, d = 0.16;
    const carrier = new THREE.Group(), body = new THREE.Group(); carrier.add(body); group.add(carrier);
    const geo = new THREE.BoxGeometry(w, h, d);
    body.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x0a0818 })));
    body.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), lineMat(COLORS.lav, 0.7, 0.35)));
    const gl = glyphs(w, h), front = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(gl), lineMat(COLORS.violet, 1.4, 0.9)); front.position.z = d / 2; body.add(front);
    const back = front.clone(); back.material = lineMat(COLORS.violet, 1.4, 0.9); back.position.z = -d / 2; back.rotation.y = Math.PI; body.add(back);
    const gem = glowSprite(COLORS.violet, 0.9, 0.8); gem.position.set(w * 0.42, -h * 0.4, 0); body.add(gem);
    slabs.push({ carrier, body, front, back, gem, w, h, i, phase: rnd(0, TAU), turn: rnd(0.08, 0.2) * (i % 2 ? 1 : -1) });
  }

  // dust: grit shaken loose, drifting between the slabs and streaming back in flight
  const DUST = 60, dpos = new Float32Array(DUST * 3), dust = Array.from({ length: DUST }, () => ({ t: Math.random(), a: rnd(0, TAU), r: rnd(0.5, 2.2), v: rnd(0.15, 0.4) }));
  const dgeo = new THREE.BufferGeometry(); dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const dustPts = new THREE.Points(dgeo, new THREE.PointsMaterial({ color: COLORS.lav, size: 0.09, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })); dustPts.frustumCulled = false; group.add(dustPts);

  const engines = [glowSprite(COLORS.violet, 1.8, 0.6)]; group.add(engines[0]);

  const bend = new Bender();
  let t = 0, w = 0, mill = 0, millAngle = 0;   // w: 0 stack, 1 shingle
  const tmp = new THREE.Vector3();
  const mix = (a, b) => a + (b - a) * w;

  function update(dt, state) {
    t += dt;
    const b = state.bend; if (b) bend.set(b.trail, b.scale, b.inv, b.invQ, b.spin || 0);
    w += (clamp(state.speedFrac * 1.9 + state.thrust * 0.5, 0, 1) - w) * damp(2, dt);
    mill += ((state.orbiting ? 1 : 0) - mill) * damp(1.6, dt);
    millAngle += dt * mill * 1.1;
    const energy = 0.35 + state.speedFrac * 0.65 + state.thrust * 0.3;

    for (const s of slabs) {
      const u = (s.i - (SLABS - 1) / 2) / ((SLABS - 1) / 2);   // -1 front .. 1 back
      // stack: spaced along the axis, faces forward (XY plane), each turned a little on Z; shingle: pushed back, tilted to lie along the axis, stepped down
      const zStack = u * 1.5, zShingle = 1.2 + u * 2.6 + state.thrust * 0.6;
      const yStack = Math.sin(t * 0.7 + s.phase) * 0.15, yShingle = -u * 0.55;
      // mill: swing out to a radius and wheel around the axis
      const ma = millAngle + s.i / SLABS * TAU, mr = 2.4 * mill;
      const x = Math.cos(ma) * mr, y = mix(yStack, yShingle) * (1 - mill) + Math.sin(ma) * mr, z = mix(zStack, zShingle) * (1 - mill * 0.6);
      bend.place(s.carrier, x, y, z);
      // orientation inside the carrier: stack turns on Z, shingle pitches up so the slab lies almost flat along the axis, mill faces outward
      s.body.rotation.set(mix(0, -1.15) * (1 - mill) + mill * 0, 0, (Math.sin(t * s.turn * 4 + s.phase) * 0.35 * (1 - w)) * (1 - mill) + mill * (ma + Math.PI / 2));
      if (mill > 0.01) s.body.rotation.x = mix(0, -1.15) * (1 - mill);
      // glyphs pulse in sequence down the stack, and burn steady in flight
      const seq = 0.5 + 0.5 * Math.sin(t * 2.5 - s.i * 0.9);
      const op = mix(0.35 + 0.6 * seq, 0.9) * (0.7 + energy * 0.3);
      s.front.material.opacity = op; s.back.material.opacity = op; s.gem.material.opacity = 0.4 + 0.6 * seq;
    }
    // core
    core.rotation.y += dt * 0.6; core.rotation.x += dt * 0.25;
    core.scale.setScalar(0.9 + 0.15 * Math.sin(t * 3) + state.thrust * 0.3);
    coreGlow[0].scale.setScalar(3.5 + state.thrust * 1.2 + w * 0.8);
    bend.place(core, 0, 0, 0); for (const g of coreGlow) bend.place(g, 0, 0, 0);
    bend.place(engines[0], 0, -0.4 * w, 3.6 * w + 1.5);
    // dust
    const back = 2 + state.speedFrac * 9;
    for (let i = 0; i < DUST; i++) {
      const d = dust[i]; d.t = (d.t + d.v * dt * (0.5 + w * 2)) % 1;
      const a = d.a + t * 0.15 + millAngle, r = d.r * (1 - w * 0.5);
      tmp.set(Math.cos(a) * r, Math.sin(a) * r * 0.7, -1.5 + d.t * (3 + w * back)); bend.point(tmp); dpos.set([tmp.x, tmp.y, tmp.z], i * 3);
    }
    dgeo.attributes.position.needsUpdate = true;
    dustPts.material.opacity = 0.25 + 0.4 * state.speedFrac;
  }
  return { group, engines, update };
}
