// Resizable HUD panel: drag any corner grip to resize, edges snap to an invisible screen grid. Size and position persist in localStorage.
import { WORLD } from './config.js';
import { clamp } from './utils.js';

export class ResizablePanel {
  constructor(el, { key = el.id, grid = WORLD.hudGrid, min = WORLD.overviewMin } = {}) {
    this.el = el; this.key = `panel:${key}`; this.grid = grid; this.min = min;
    this.rect = this.load() || this.measure();
    this.apply();
    for (const c of ['tl', 'tr', 'bl', 'br']) {
      const g = document.createElement('div'); g.className = `grip ${c}`; g.dataset.corner = c;
      g.addEventListener('pointerdown', (e) => this.start(e, c));
      el.appendChild(g);
    }
    window.addEventListener('resize', () => { this.clampToScreen(); this.apply(); });
  }
  measure() { const r = this.el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }
  snap(v) { return Math.round(v / this.grid) * this.grid; }
  load() { try { const r = JSON.parse(localStorage.getItem(this.key)); return r && Number.isFinite(r.w) ? r : null; } catch { return null; } }
  save() { try { localStorage.setItem(this.key, JSON.stringify(this.rect)); } catch { /* storage blocked, fine */ } }
  apply() {
    const { x, y, w, h } = this.rect; const s = this.el.style;
    s.left = `${x}px`; s.top = `${y}px`; s.width = `${w}px`; s.height = `${h}px`; s.right = 'auto'; s.bottom = 'auto';
  }
  clampToScreen() {
    const r = this.rect;
    r.w = clamp(r.w, this.min[0], window.innerWidth); r.h = clamp(r.h, this.min[1], window.innerHeight);
    r.x = clamp(r.x, 0, window.innerWidth - r.w); r.y = clamp(r.y, 0, window.innerHeight - r.h);
  }
  start(e, corner) {
    e.preventDefault(); e.stopPropagation();
    const o = { ...this.rect }, sx = e.clientX, sy = e.clientY;
    const left = corner[1] === 'l', top = corner[0] === 't';
    this.el.classList.add('resizing');
    const move = (ev) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      // move the dragged edges, snap them to the grid, then keep the opposite edges fixed
      let x0 = o.x, x1 = o.x + o.w, y0 = o.y, y1 = o.y + o.h;
      if (left) x0 = this.snap(o.x + dx); else x1 = this.snap(o.x + o.w + dx);
      if (top) y0 = this.snap(o.y + dy); else y1 = this.snap(o.y + o.h + dy);
      if (x1 - x0 < this.min[0]) { if (left) x0 = x1 - this.min[0]; else x1 = x0 + this.min[0]; }
      if (y1 - y0 < this.min[1]) { if (top) y0 = y1 - this.min[1]; else y1 = y0 + this.min[1]; }
      this.rect = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      this.clampToScreen(); this.apply();
    };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      this.el.classList.remove('resizing'); this.save();
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  }
}
