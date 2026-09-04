// Rifts: what marks a combat site. A tear in the energy field: a dark core with a magenta glow, jagged cracks radiating
// out (slowly crawling), a ring of wireframe shards orbiting it, and sparks bleeding off the cracks. Wisps spawn from here.
import * as THREE from 'three';
import { COLORS } from './config.js';
import { glowSprite } from './materials.js';
import { rnd, TAU } from './utils.js';

const CRACKS = 11, CRACK_SEG = 9, SHARDS = 9, SPARKS = 90;
const RED = 0xff3d7a, PINK = 0xff8fb0, DARK = 0x2a0616;

export class Rifts {
  /** sites: combat site groups; each gets a rift linked to it */
  constructor(scene, sites) {
    this.group = new THREE.Group(); scene.add(this.group);
    this.list = sites.map((st) => this.build(st));
    this._tmp = new THREE.Vector3();
  }
  add(site) { const r = this.build(site); this.list.push(r); return r; }
  /** start the collapse: cracks retract, shards fall in, the core swells then vanishes in a flash */
  collapse(rift) { if (!rift.collapsing) { rift.collapsing = 0; } }
  build(site) {
    const centre = site.position;
    const g = new THREE.Group(); g.position.copy(centre); g.t = rnd(0, 100); g.site = site;
    g.rotation.set(rnd(-0.4, 0.4), rnd(0, TAU), rnd(-0.4, 0.4));
    // core
    g.add(new THREE.Mesh(new THREE.SphereGeometry(9, 20, 14), new THREE.MeshBasicMaterial({ color: DARK })));
    const glow = glowSprite(RED, 70, 0.5); g.add(glow); g.glow = glow;
    const inner = glowSprite(PINK, 24, 0.7); g.add(inner); g.inner = inner;
    g.core = g.children[0];
    // cracks: jagged polylines from the core outward, kept so they can crawl
    g.cracks = [];
    for (let i = 0; i < CRACKS; i++) {
      const a = i / CRACKS * TAU + rnd(-0.15, 0.15), tilt = rnd(-0.5, 0.5), len = rnd(90, 170);
      const dir = new THREE.Vector3(Math.cos(a) * Math.cos(tilt), Math.sin(tilt), Math.sin(a) * Math.cos(tilt));
      const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
      const base = [], pos = new Float32Array((CRACK_SEG + 1) * 3);
      for (let k = 0; k <= CRACK_SEG; k++) { const f = k / CRACK_SEG; base.push(dir.clone().multiplyScalar(9 + len * f).addScaledVector(side, (k === 0 ? 0 : rnd(-1, 1)) * 12 * f)); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: new THREE.Color(i % 3 ? RED : PINK).multiplyScalar(1.3), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
      line.frustumCulled = false; g.add(line);
      g.cracks.push({ base, pos, line, side, ph: rnd(0, TAU) });
    }
    // shards: small wireframe tetrahedra orbiting on a tilted ring
    g.shards = [];
    const tet = new THREE.EdgesGeometry(new THREE.TetrahedronGeometry(6, 0));
    for (let i = 0; i < SHARDS; i++) {
      const m = new THREE.LineSegments(tet, new THREE.LineBasicMaterial({ color: new THREE.Color(PINK).multiplyScalar(1.1), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.a = i / SHARDS * TAU; m.r = rnd(55, 85); m.w = rnd(0.08, 0.16); m.spin = new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1));
      g.add(m); g.shards.push(m);
    }
    // sparks bleeding off the cracks
    const sp = new Float32Array(SPARKS * 3); g.spos = sp; g.sparks = Array.from({ length: SPARKS }, () => ({ c: Math.floor(rnd(0, CRACKS)), f: Math.random(), v: rnd(0.15, 0.4), off: rnd(-3, 3) }));
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); g.sgeo = sg;
    const pts = new THREE.Points(sg, new THREE.PointsMaterial({ color: new THREE.Color(PINK).multiplyScalar(1.4), size: 1.6, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    pts.frustumCulled = false; g.add(pts);
    // collapse props, hidden until needed: three shockwave rings on the main planes and a spray of burst sparks
    const ringPts = []; for (let i = 0; i <= 96; i++) { const a = i / 96 * TAU; ringPts.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0)); }
    const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPts);
    g.rings = [[0, 0, 0], [Math.PI / 2, 0, 0], [0, Math.PI / 2, 0]].map((rot) => {
      const r = new THREE.LineLoop(ringGeo, new THREE.LineBasicMaterial({ color: new THREE.Color(PINK).multiplyScalar(1.5), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      r.rotation.set(...rot); r.visible = false; r.frustumCulled = false; g.add(r); return r;
    });
    const bn = 220, bp = new Float32Array(bn * 3); g.bpos = bp; g.burst = Array.from({ length: bn }, () => ({ d: new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize(), v: rnd(60, 220), r: 0 }));
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(bp, 3)); g.bgeo = bg;
    g.burstPts = new THREE.Points(bg, new THREE.PointsMaterial({ color: new THREE.Color(0xffffff), size: 2.2, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    g.burstPts.visible = false; g.burstPts.frustumCulled = false; g.add(g.burstPts);
    this.group.add(g);
    return g;
  }
  update(dt) {
    for (let idx = this.list.length - 1; idx >= 0; idx--) {
      const g = this.list[idx];
      g.t += dt; const t = g.t;
      if (g.collapsing !== undefined) {
        // collapse, ~8 s in four acts:
        //   0-3   tremor: cracks flail and flicker, shards race, core throbs faster and faster
        //   3-5.5 implosion: cracks retract, shards fall in, glow shrinks to a pinpoint
        //   5.5-6 the pinpoint holds, white, silent
        //   6-8   burst: three shockwave rings, a spray of sparks, the glow blooms and fades
        g.collapsing += dt; const c = g.collapsing;
        const tremor = Math.min(1, c / 3), implode = Math.max(0, Math.min(1, (c - 3) / 2.5)), hold = c > 5.5 && c < 6, burst = Math.max(0, Math.min(1, (c - 6) / 2));
        const rate = 1 + tremor * 6;
        for (const cr of g.cracks) {
          for (let k = 0; k <= CRACK_SEG; k++) {
            const b = cr.base[k], f = k / CRACK_SEG, j = k === 0 ? 0 : Math.sin(t * 2.3 * rate + cr.ph + k * 1.7) * (2.5 + tremor * 14) * f;
            this._tmp.copy(b).multiplyScalar(1 - implode).addScaledVector(cr.side, j * (1 - implode)); cr.pos.set([this._tmp.x, this._tmp.y, this._tmp.z], k * 3);
          }
          cr.line.geometry.attributes.position.needsUpdate = true;
          cr.line.material.opacity = (0.45 + 0.5 * Math.max(0, Math.sin(t * 3.1 * rate + cr.ph * 2))) * (1 - implode) * (burst > 0 ? 0 : 1);
        }
        for (const m of g.shards) {
          m.w += dt * (0.6 + tremor * 2); m.r = Math.max(2, m.r * (1 - implode * dt * 2.5));
          m.position.set(Math.cos(m.a) * m.r, Math.sin(m.a * 2) * 8 * (1 - implode), Math.sin(m.a) * m.r); m.a += m.w * dt;
          m.rotation.x += m.spin.x * dt * rate; m.rotation.y += m.spin.y * dt * rate;
          m.material.opacity = 0.7 * (1 - implode) * (burst > 0 ? 0 : 1);
        }
        const throb = 0.5 + 0.5 * Math.sin(t * (1.3 + tremor * 9));
        const coreS = burst > 0 ? Math.max(0.01, 1 - burst * 2) : hold ? 0.18 : 1 + throb * 0.35 * tremor - implode * 0.8;
        g.core.scale.setScalar(Math.max(0.01, coreS));
        g.glow.scale.setScalar(hold ? 18 : burst > 0 ? 80 + burst * 900 : 60 + throb * 30 * (1 + tremor) - implode * 60);
        g.glow.material.opacity = burst > 0 ? 0.9 * (1 - burst) : hold ? 1 : 0.4 + throb * 0.4 * tremor;
        g.inner.scale.setScalar(hold ? 10 : burst > 0 ? 40 + burst * 500 : 24 + throb * 10 - implode * 16);
        g.inner.material.opacity = burst > 0 ? 1 - burst : hold ? 1 : 0.7;
        // sparks keep bleeding through the tremor, vanish on implosion
        if (implode > 0) g.sgeo.attributes.position.array.fill(-1e6);
        else for (let i = 0; i < SPARKS; i++) { const sp = g.sparks[i], cr = g.cracks[sp.c]; sp.f += sp.v * dt * rate; if (sp.f > 1) { sp.f = 0; sp.c = Math.floor(rnd(0, CRACKS)); } const k = Math.min(CRACK_SEG - 1, Math.floor(sp.f * CRACK_SEG)), fr = sp.f * CRACK_SEG - k; this._tmp.copy(cr.base[k]).lerp(cr.base[k + 1], fr).addScaledVector(cr.side, sp.off); g.spos.set([this._tmp.x, this._tmp.y, this._tmp.z], i * 3); }
        g.sgeo.attributes.position.needsUpdate = true;
        // burst: shockwave rings and spray
        if (burst > 0) {
          g.rings.forEach((r, i) => { r.visible = true; const bf = Math.max(0, Math.min(1, (burst - i * 0.08) / 0.92)); r.scale.setScalar(2 + bf * 900); r.material.opacity = 0.9 * (1 - bf) * (1 - bf); });
          g.burstPts.visible = true; g.burstPts.material.opacity = 1 - burst;
          for (let i = 0; i < g.burst.length; i++) { const b = g.burst[i]; b.r += b.v * dt * (1.5 - burst); g.bpos.set([b.d.x * b.r, b.d.y * b.r, b.d.z * b.r], i * 3); }
          g.bgeo.attributes.position.needsUpdate = true;
        }
        if (c >= 8) { this.group.remove(g); this.list.splice(idx, 1); }
        continue;
      }
      const pulse = 0.5 + 0.5 * Math.sin(t * 1.3);
      g.glow.scale.setScalar(60 + pulse * 18); g.glow.material.opacity = 0.35 + pulse * 0.25;
      for (const c of g.cracks) {
        for (let k = 0; k <= CRACK_SEG; k++) {
          const b = c.base[k], f = k / CRACK_SEG, j = k === 0 ? 0 : Math.sin(t * 2.3 + c.ph + k * 1.7) * 2.5 * f;   // slow crawl
          this._tmp.copy(b).addScaledVector(c.side, j); c.pos.set([this._tmp.x, this._tmp.y, this._tmp.z], k * 3);
        }
        c.line.geometry.attributes.position.needsUpdate = true;
        c.line.material.opacity = 0.45 + 0.4 * Math.max(0, Math.sin(t * 3.1 + c.ph * 2));   // flicker
      }
      for (const m of g.shards) { m.a += m.w * dt; m.position.set(Math.cos(m.a) * m.r, Math.sin(m.a * 2) * 8, Math.sin(m.a) * m.r); m.rotation.x += m.spin.x * dt; m.rotation.y += m.spin.y * dt; }
      for (let i = 0; i < SPARKS; i++) {
        const s = g.sparks[i], c = g.cracks[s.c]; s.f += s.v * dt; if (s.f > 1) { s.f = 0; s.c = Math.floor(rnd(0, CRACKS)); }
        const k = Math.min(CRACK_SEG - 1, Math.floor(s.f * CRACK_SEG)), fr = s.f * CRACK_SEG - k;
        this._tmp.copy(c.base[k]).lerp(c.base[k + 1], fr).addScaledVector(c.side, s.off);
        g.spos.set([this._tmp.x, this._tmp.y, this._tmp.z], i * 3);
      }
      g.sgeo.attributes.position.needsUpdate = true;
    }
  }
}
