// Persistent progress: fragments (hold by energy key, scrap total), fits per shell and owned modules live in localStorage.
// Writes are debounced: motes land many times a second, so we mark dirty and flush at most once a second, plus on page hide.
const KEY = 'progress';

export function loadProgress() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY));
    if (!p || typeof p !== 'object') return { scrap: 0, hold: {}, fits: {}, owned: {} };
    const obj = (v) => v && typeof v === 'object' ? v : {};
    return { scrap: Number.isFinite(p.scrap) ? p.scrap : 0, hold: obj(p.hold), fits: obj(p.fits), owned: obj(p.owned) };
  } catch { return { scrap: 0, hold: {}, fits: {}, owned: {} }; }
}

export class ProgressSaver {
  constructor(state, { interval = 1 } = {}) {
    this.state = state; this.interval = interval; this.timer = 0; this.dirty = false;
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.flush(); });
    window.addEventListener('pagehide', () => this.flush());
  }
  mark() { this.dirty = true; }
  update(dt) { this.timer -= dt; if (this.dirty && this.timer <= 0) this.flush(); }
  flush() {
    if (!this.dirty) return;
    this.dirty = false; this.timer = this.interval;
    try { localStorage.setItem(KEY, JSON.stringify({ scrap: this.state.scrap, hold: this.state.hold, fits: this.state.fits, owned: this.state.owned })); } catch { /* storage blocked */ }
  }
  reset() { this.state.scrap = 0; this.state.hold = {}; this.state.fits = {}; this.state.owned = {}; this.dirty = true; this.flush(); }
}
