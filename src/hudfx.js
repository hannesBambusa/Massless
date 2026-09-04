// Living HUD layer: a 2D canvas over the panels, drawn every frame like the ship is. Strands, motes and sparks, additive glow.
// It reads the DOM for where the command core and the overview are, so it wraps the real UI without owning it.
// Forms per state: nav = calm bloom, harvest = petals reach toward the yield block, combat = sharp lance spikes.
import { rnd, TAU, damp, clamp } from './utils.js';

const STRANDS = 30, MOTES = 30, THREAD_SPARKS = 8, EDGE_MOTES = 14;
const PALETTE = {
  nav: ['#5ce6d6', '#9be7ff', '#ffffff', '#9f8cff'],
  harvest: ['#ffd166', '#ffb347', '#ffffff', '#5ce6d6'],
  combat: ['#ff5f8a', '#ff3d7a', '#ffffff', '#ffb0c8'],
};

export class HudFx {
  constructor() {
    this.cv = document.createElement('canvas'); this.cv.id = 'hudfx';
    document.body.appendChild(this.cv);
    this.ctx = this.cv.getContext('2d');
    this.t = 0; this.state = 'nav'; this.w = { nav: 1, harvest: 0, combat: 0 }; this.burst = 0;
    this.strands = Array.from({ length: STRANDS }, (_, i) => ({ a: i / STRANDS * TAU + rnd(-0.05, 0.05), ph: rnd(0, TAU), sp: rnd(0.5, 1.1), len: rnd(0.55, 1.25), c: i % 4, k: rnd(0.7, 1.3) }));
    this.motes = Array.from({ length: MOTES }, () => ({ a: rnd(0, TAU), r: rnd(0.5, 1.4), w: rnd(0.3, 1.2) * (Math.random() < 0.5 ? 1 : -1), s: rnd(1, 2.4), c: Math.floor(rnd(0, 4)) }));
    this.sparks = Array.from({ length: THREAD_SPARKS }, () => ({ t: Math.random(), v: rnd(0.08, 0.2) }));
    this.edge = Array.from({ length: EDGE_MOTES }, () => ({ t: Math.random(), v: rnd(0.03, 0.08), o: rnd(-3, 3) }));
    this.resize(); window.addEventListener('resize', () => this.resize());
    this.gauge = document.querySelector('.cmd-gauge'); this.cmd = document.getElementById('cmd'); this.ov = document.getElementById('overview'); this.ovList = document.getElementById('overview-list');
  }
  resize() { this.cv.width = innerWidth * devicePixelRatio; this.cv.height = innerHeight * devicePixelRatio; this.cv.style.width = innerWidth + 'px'; this.cv.style.height = innerHeight + 'px'; }
  setState(s) { if (s !== this.state) { this.state = s; this.burst = 1; } }

  /** info: { hp 0..1, lock 0..1, speed 0..1, hunting bool, selected bool } */
  update(dt, info) {
    this.t += dt;
    for (const k in this.w) this.w[k] += ((k === this.state ? 1 : 0) - this.w[k]) * damp(3, dt);
    this.burst = Math.max(0, this.burst - dt * 1.4);
    const ctx = this.ctx, dpr = devicePixelRatio;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.globalCompositeOperation = 'lighter';
    const pal = this.mix(PALETTE.nav, PALETTE.harvest, PALETTE.combat);
    const cmdOn = this.cmd && getComputedStyle(this.cmd).display !== 'none';
    if (cmdOn && this.gauge) this.drawCore(ctx, pal, info);
    if (cmdOn) this.drawPanelEdge(ctx, this.cmd.getBoundingClientRect(), pal, 0);
    if (this.ov) { this.drawPanelEdge(ctx, this.ov.getBoundingClientRect(), pal, 1); this.drawThread(ctx, pal); }
    ctx.globalCompositeOperation = 'source-over';
  }

  mix(a, b, c) {
    const w = this.w, out = [];
    for (let i = 0; i < 4; i++) {
      const A = hex(a[i]), B = hex(b[i]), C = hex(c[i]);
      const s = w.nav + w.harvest + w.combat || 1;
      out.push(`rgb(${(A[0] * w.nav + B[0] * w.harvest + C[0] * w.combat) / s | 0},${(A[1] * w.nav + B[1] * w.harvest + C[1] * w.combat) / s | 0},${(A[2] * w.nav + B[2] * w.harvest + C[2] * w.combat) / s | 0})`);
    }
    return out;
  }

  /** the bloom: petal strands around the gauge, morphing with state, plus orbiting motes */
  drawCore(ctx, pal, info) {
    const r = this.gauge.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width / 2;
    const t = this.t, w = this.w, burst = this.burst;
    // the hairs only swirl while the HUD is morphing into a state, then settle in place
    this.spinV = (this.spinV || 0) + ((burst > 0.05 ? 2.2 * burst : 0) - (this.spinV || 0)) * damp(4, dt0);
    this.spinA = (this.spinA || 0) + this.spinV * dt0;
    const spin = this.spinA;
    // hairs in water: single hair-thin filaments rooted on the ring, drifting with a slow shared current plus their own
    // travelling waves. Displacement grows toward the tip (f^1.6) so the root barely moves and the tip trails behind.
    const cur = { x: Math.sin(t * 0.37) * 0.6 + Math.sin(t * 0.11) * 0.4, y: Math.cos(t * 0.29) * 0.6 + Math.cos(t * 0.17) * 0.4 };   // the water, changing direction slowly
    const SEG = 26;
    ctx.lineCap = 'round';
    const tips = [];
    for (const s of this.strands) {
      const a = s.a + spin;
      const reach = R * (0.32 + 0.06 * w.harvest + 0.03 * w.combat + burst * 0.5) * s.len;
      const dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
      const col = pal[s.c];
      ctx.strokeStyle = col; ctx.lineWidth = 0.45 + w.combat * 0.1;  ctx.shadowBlur = 0;
      ctx.globalAlpha = (0.3 + 0.18 * Math.sin(t * 1.3 * s.sp + s.ph) + burst * 0.4 + (info.selected ? 0.1 : 0)) * (1 - w.combat * 0.92) * (1 - w.harvest * 0.92);
      if (ctx.globalAlpha < 0.02) continue;
      ctx.beginPath();
      for (let i = 0; i <= SEG; i++) {
        const f = i / SEG, g = Math.pow(f, 1.6);
        // sideways sway: two travelling waves along the hair, plus the shared current projected on the hair's normal
        const wave = Math.sin(f * 5.5 * s.k - t * 1.7 * s.sp + s.ph) * 0.55 + Math.sin(f * 2.4 - t * 0.9 * s.sp + s.ph * 1.7) * 0.45;
        const side = (wave * 0.55 * reach + (cur.x * nx + cur.y * ny) * 0.45 * reach * (1 + w.combat * 0.6)) * g;   // wide sway so neighbours meet
        // the current also bends the hair along its length a little, like drag
        const along = R * 1.03 + reach * f + (cur.x * dx + cur.y * dy) * 0.08 * reach * g;
        const x = cx + dx * along + nx * side, y = cy + dy * along + ny * side;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        if (i === SEG) tips.push({ x, y, s });
      }
      ctx.lineWidth = 2.2; ctx.globalAlpha *= 0.22; ctx.stroke();   // soft halo
      ctx.lineWidth = 0.45 + w.combat * 0.1; ctx.globalAlpha /= 0.22; ctx.stroke();
      // a faint bead near the tip, drifting up and down the hair
      const bf = 0.6 + 0.35 * Math.sin(t * 0.8 * s.sp + s.ph), bg = Math.pow(bf, 1.6);
      const bwave = Math.sin(bf * 5.5 * s.k - t * 1.7 * s.sp + s.ph) * 0.55 + Math.sin(bf * 2.4 - t * 0.9 * s.sp + s.ph * 1.7) * 0.45;
      const bside = (bwave * 0.55 * reach + (cur.x * nx + cur.y * ny) * 0.45 * reach * (1 + w.combat * 0.6)) * bg;
      const balong = R * 1.03 + reach * bf + (cur.x * dx + cur.y * dy) * 0.08 * reach * bg;
      ctx.fillStyle = '#fff';  ctx.shadowBlur = 0; ctx.globalAlpha = 0.25 + 0.25 * Math.sin(t * 2.3 + s.ph);
      ctx.beginPath(); ctx.arc(cx + dx * balong + nx * bside, cy + dy * balong + ny * bside, 0.9, 0, TAU); ctx.fill();
    }
    // sparks: when two neighbouring hair tips drift close, a short jagged arc jumps between them for a few frames
    this.arcs = this.arcs || [];
    const near = R * 0.09;
    for (let i = 0; i < tips.length; i++) {
      const a = tips[i], b = tips[(i + 1) % tips.length];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < near && Math.random() < 0.25 && !this.arcs.some((z) => z.i === i)) this.arcs.push({ i, life: rnd(0.12, 0.3), seed: Math.random() * 100 });
    }
    for (let k = this.arcs.length - 1; k >= 0; k--) {
      const z = this.arcs[k]; z.life -= dt0;
      if (z.life <= 0) { this.arcs.splice(k, 1); continue; }
      const a = tips[z.i], b = tips[(z.i + 1) % tips.length]; if (!a || !b) continue;
      ctx.strokeStyle = '#fff'; ctx.globalAlpha = 0.5 + 0.5 * Math.random();
      ctx.beginPath(); ctx.moveTo(a.x, a.y);
      for (let j = 1; j < 5; j++) { const f = j / 5, jx = a.x + (b.x - a.x) * f, jy = a.y + (b.y - a.y) * f; const n = Math.sin(z.seed + j * 7 + t * 60) * 3; ctx.lineTo(jx + n, jy - n); }
      ctx.lineTo(b.x, b.y);
      ctx.lineWidth = 2.4; ctx.globalAlpha *= 0.3; ctx.stroke();
      ctx.lineWidth = 0.7; ctx.globalAlpha /= 0.3; ctx.stroke();
    }
    // harvest: energy is drawn in. Motes spawn beyond the ring and spiral inward into the hub, flashing as they arrive;
    // faint spiral streams show the pull. Rate follows the lance lock.
    this.inflow = this.inflow || [];
    if (w.harvest > 0.2) {
      const rate = (14 + info.lock * 30) * w.harvest;
      if (Math.random() < rate * dt0) this.inflow.push({ a: rnd(0, TAU), r: rnd(1.6, 2.1), v: rnd(0.55, 0.9), sp: rnd(1.2, 2.2) * (Math.random() < 0.5 ? 1 : -1), c: Math.random() < 0.7 ? 0 : 2, sz: rnd(0.8, 1.6) });
      // spiral streams: four arms, slowly turning, brighter near the ring
      for (let arm = 0; arm < 4; arm++) {
        ctx.strokeStyle = pal[arm % 2 ? 1 : 0]; ctx.lineWidth = 0.6; ctx.globalAlpha = 0.22 * w.harvest;
        ctx.beginPath();
        for (let i = 0; i <= 30; i++) { const f = i / 30, rr = R * (1.02 + 0.95 * f), a = arm * TAU / 4 - f * 2.4 + t * 0.35; const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.stroke();
      }
    }
    for (let k = this.inflow.length - 1; k >= 0; k--) {
      const m = this.inflow[k];
      m.r -= m.v * dt0 * (0.6 + (2.1 - m.r));            // accelerates as it nears the hub
      m.a += m.sp * dt0 * (2.2 - m.r);                    // and spins faster
      if (m.r <= 1.02) {
        this.inflow.splice(k, 1);
        this.flashes = this.flashes || []; this.flashes.push({ a: m.a, life: 0.18 });
        continue;
      }
      const x = cx + Math.cos(m.a) * R * m.r, y = cy + Math.sin(m.a) * R * m.r, col = pal[m.c];
      ctx.fillStyle = col; ctx.globalAlpha = 0.5 + 0.5 * (2.1 - m.r);
      ctx.beginPath(); ctx.arc(x, y, m.sz * (0.7 + (2.1 - m.r) * 0.5), 0, TAU); ctx.fill();
      // short tail behind the mote along its spiral
      ctx.strokeStyle = col; ctx.lineWidth = 0.7; ctx.globalAlpha *= 0.5;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(cx + Math.cos(m.a - m.sp * 0.08) * R * (m.r + 0.06), cy + Math.sin(m.a - m.sp * 0.08) * R * (m.r + 0.06)); ctx.stroke();
    }
    this.flashes = this.flashes || [];
    for (let k = this.flashes.length - 1; k >= 0; k--) {
      const f = this.flashes[k]; f.life -= dt0; if (f.life <= 0) { this.flashes.splice(k, 1); continue; }
      const x = cx + Math.cos(f.a) * R * 1.02, y = cy + Math.sin(f.a) * R * 1.02;
      ctx.fillStyle = '#fff'; ctx.globalAlpha = f.life / 0.18;
      ctx.beginPath(); ctx.arc(x, y, 1.5 + (0.18 - f.life) * 14, 0, TAU); ctx.fill();
    }
    // combat: energy arcs out of the hub. Jagged bolts spawn around the ring, live a few frames, some fork once
    this.bolts = this.bolts || [];
    if (w.combat > 0.2) {
      const rate = (10 + info.lock * 18 + (info.hunting ? 8 : 0)) * w.combat;
      if (Math.random() < rate * dt0) {
        const a = rnd(0, TAU);
        this.bolts.push({ a, len: R * rnd(0.35, 0.9), life: rnd(0.06, 0.18), max: 0.18, seed: rnd(0, 100), fork: Math.random() < 0.5, c: Math.random() < 0.6 ? 0 : 2 });
      }
    }
    ctx.lineCap = 'round';
    for (let k = this.bolts.length - 1; k >= 0; k--) {
      const b = this.bolts[k]; b.life -= dt0;
      if (b.life <= 0) { this.bolts.splice(k, 1); continue; }
      const col = pal[b.c], jag = R * 0.06, N = 7;
      const dx = Math.cos(b.a), dy = Math.sin(b.a), nx = -dy, ny = dx;
      const pts = [];
      for (let i = 0; i <= N; i++) { const f = i / N, off = i === 0 || i === N ? 0 : Math.sin(b.seed + i * 13.7 + t * 90) * jag * (0.4 + f); const along = R * 1.02 + b.len * f; pts.push([cx + dx * along + nx * off, cy + dy * along + ny * off]); }
      const alpha = Math.min(1, b.life / b.max * 2.2);
      ctx.strokeStyle = col; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
      ctx.lineWidth = 3; ctx.globalAlpha = 0.18 * alpha; ctx.stroke();
      ctx.lineWidth = 0.9; ctx.globalAlpha = 0.9 * alpha; ctx.stroke();
      if (b.fork) {   // one branch off the middle
        const m = pts[3], fa = b.a + (b.seed % 2 ? 0.7 : -0.7), fl = b.len * 0.45;
        ctx.beginPath(); ctx.moveTo(m[0], m[1]);
        for (let i = 1; i <= 4; i++) { const f = i / 4, off = i === 4 ? 0 : Math.sin(b.seed * 3 + i * 9 + t * 80) * jag * 0.5; ctx.lineTo(m[0] + Math.cos(fa) * fl * f - Math.sin(fa) * off, m[1] + Math.sin(fa) * fl * f + Math.cos(fa) * off); }
        ctx.lineWidth = 0.7; ctx.globalAlpha = 0.6 * alpha; ctx.stroke();
      }
      // hot root on the ring
      ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.8 * alpha; ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], 1.4, 0, TAU); ctx.fill();
    }
    // crackle halo just outside the ring while in combat
    if (w.combat > 0.05) {
      ctx.strokeStyle = pal[0]; ctx.lineWidth = 1; ctx.globalAlpha = 0.25 * w.combat;
      ctx.beginPath();
      for (let i = 0; i <= 90; i++) { const a = i / 90 * TAU, rr = R * 1.04 + Math.sin(a * 11 + t * 25) * R * 0.02 + Math.sin(a * 5 - t * 17) * R * 0.015; const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.closePath(); ctx.stroke();
    }
    // hp / lock as living arcs: a thick soft arc with a bright head that jitters
    ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.lineCap = 'round';
    if (info.selected) {
      this.arc(ctx, cx, cy, R * 0.86, info.hp, pal[1 + (this.state === 'harvest' ? -1 : 0)], 3);
      if (info.lock > 0) this.arc(ctx, cx, cy, R * 0.66, info.lock, pal[2], 2.5, true);
    }
    this.arc(ctx, cx, cy, R * 1.0, info.speed, pal[3], 1.5);
    // motes
    for (const m of this.motes) {
      m.a += m.w * dt0 * (1 + w.combat);
      const rr = R * (0.55 + m.r * (0.5 + w.harvest * 0.5 + burst)) * (1 + 0.06 * Math.sin(t * m.s));
      const x = cx + Math.cos(m.a) * rr, y = cy + Math.sin(m.a) * rr * (1 - w.combat * 0.3);
      ctx.fillStyle = pal[m.c];  ctx.shadowBlur = 0; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * m.s * 2 + m.a);
      ctx.beginPath(); ctx.arc(x, y, 1.2 + (m.c === 2 ? 0.6 : 0), 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }
  arc(ctx, cx, cy, r, f, col, lw, ccw = false) {
    if (f <= 0) return;
    const a0 = -Math.PI / 2, a1 = a0 + TAU * clamp(f, 0, 1) * (ccw ? -1 : 1);
    ctx.strokeStyle = col;  ctx.lineWidth = lw; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1, ccw); ctx.stroke();
    const hx = cx + Math.cos(a1) * r, hy = cy + Math.sin(a1) * r;   // bright head
    ctx.fillStyle = '#fff';  ctx.shadowBlur = 0; ctx.beginPath(); ctx.arc(hx, hy, lw * 0.9 + Math.sin(this.t * 14) * 0.5, 0, TAU); ctx.fill();
  }

  /** panel edge as a swaying strand with motes riding it, instead of a hard border */
  drawPanelEdge(ctx, r, pal, which) {
    const t = this.t, pts = [];
    const N = 40, sway = 3 + this.burst * 8;
    // path around the rect, top edge then right, bottom, left
    const per = [[r.left, r.top, r.right, r.top], [r.right, r.top, r.right, r.bottom], [r.right, r.bottom, r.left, r.bottom], [r.left, r.bottom, r.left, r.top]];
    ctx.lineWidth = 1; ctx.shadowBlur = 0;
    for (let e = 0; e < 4; e++) {
      const [x0, y0, x1, y1] = per[e], nx = e % 2 ? 1 : 0, ny = e % 2 ? 0 : 1;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const f = i / N, x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f;
        const o = Math.sin(f * 9 + t * 1.3 + e * 2 + which * 3) * sway * Math.sin(f * Math.PI);
        i ? ctx.lineTo(x + nx * o, y + ny * o) : ctx.moveTo(x, y);
      }
      const col = pal[e % 2 ? 3 : 0];
      ctx.strokeStyle = col;  ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 2 + e);
      ctx.stroke();
    }
    // motes riding the perimeter
    const P = 2 * (r.width + r.height);
    for (let i = 0; i < EDGE_MOTES; i++) {
      const m = this.edge[i]; if (which !== i % 2) continue;
      m.t = (m.t + m.v * dt0 * (1 + this.w.combat * 1.5)) % 1;
      let d = m.t * P, x, y;
      if (d < r.width) { x = r.left + d; y = r.top; } else if ((d -= r.width) < r.height) { x = r.right; y = r.top + d; } else if ((d -= r.height) < r.width) { x = r.right - d; y = r.bottom; } else { d -= r.width; x = r.left; y = r.bottom - d; }
      ctx.fillStyle = pal[2];  ctx.shadowBlur = 0; ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.arc(x + m.o * 0.3, y + m.o * 0.3, 1.5, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }

  /** the overview thread: a swaying strand down the left with sparks flowing along it, and a tendril out to each row node */
  drawThread(ctx, pal) {
    const r = this.ov.getBoundingClientRect(), x = r.left + 21, y0 = r.top + 46, y1 = r.bottom - 14, t = this.t;
    ctx.lineWidth = 1.2; ctx.strokeStyle = pal[0];  ctx.shadowBlur = 0; ctx.globalAlpha = 0.7;
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) { const f = i / 40, yy = y0 + (y1 - y0) * f, xx = x + Math.sin(f * 7 + t * 1.6) * 2.5; i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); }
    ctx.lineWidth = 3.5; ctx.globalAlpha = 0.15; ctx.stroke(); ctx.lineWidth = 1.2; ctx.globalAlpha = 0.7; ctx.stroke();
    for (const s of this.sparks) {
      s.t = (s.t + s.v * dt0 * (1 + this.w.combat)) % 1;
      const yy = y0 + (y1 - y0) * s.t, xx = x + Math.sin(s.t * 7 + t * 1.6) * 2.5;
      ctx.fillStyle = '#fff';  ctx.shadowBlur = 0; ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.arc(xx, yy, 1.6, 0, TAU); ctx.fill();
    }
    // tendrils from the thread to each node, brightest for the selected row
    if (this.ovList) {
      this.rowT = (this.rowT || 0) - dt0;
      if (this.rowT <= 0 || !this.rows) { this.rowT = 0.2; this.rows = [...this.ovList.children].map((row) => ({ row, rr: row.getBoundingClientRect() })); }
    }
    if (this.ovList) for (const { row, rr } of this.rows) {
      if (rr.bottom < r.top || rr.top > r.bottom) continue;
      const ny = rr.top + rr.height / 2, nx = rr.left + 21, on = row.classList.contains('on'), mob = row.classList.contains('mob');
      const col = on ? pal[1] : mob ? pal[0] : pal[3];
      ctx.strokeStyle = col;  ctx.shadowBlur = 0; ctx.globalAlpha = on ? 0.9 : 0.25; ctx.lineWidth = on ? 1.4 : 0.8;
      ctx.beginPath(); ctx.moveTo(x + Math.sin((ny - y0) / (y1 - y0) * 7 + t * 1.6) * 2.5, ny);
      ctx.bezierCurveTo(nx + 8 + Math.sin(t * 3 + ny) * 3, ny - 4, nx + 16, ny + Math.cos(t * 2.5 + ny) * 3, nx + 26 + (on ? 6 : 0), ny);
      ctx.stroke();
      if (on) { const px = nx + 32 + 6 * Math.sin(t * 5); ctx.fillStyle = '#fff'; ctx.shadowBlur = 0; ctx.beginPath(); ctx.arc(px, ny, 1.8, 0, TAU); ctx.fill(); }
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }
}
let dt0 = 0.016;
export const setHudDt = (dt) => { dt0 = dt; };
function hex(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
