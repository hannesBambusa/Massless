// Settings overlay: user preferences that persist in localStorage and apply as CSS variables on :root.
const KEY = 'settings';
const DEFAULTS = { fontScale: 1 };

export class Settings {
  constructor() {
    this.values = { ...DEFAULTS, ...this.load() };
    this.el = document.getElementById('settings');
    this.font = document.getElementById('set-font'); this.fontVal = document.getElementById('set-font-val');
    this.font.addEventListener('input', () => this.set('fontScale', parseFloat(this.font.value)));
    document.getElementById('set-reset').addEventListener('click', () => { this.values = { ...DEFAULTS }; this.apply(); this.save(); });
    document.getElementById('set-close').addEventListener('click', () => this.toggle(false));
    document.getElementById('btn-settings').addEventListener('click', () => this.toggle());
    this.el.addEventListener('click', (e) => { if (e.target === this.el) this.toggle(false); });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyO') this.toggle();
      else if (e.code === 'Escape' && !this.el.hidden) this.toggle(false);
    });
    this.apply();
  }
  get open() { return !this.el.hidden; }
  toggle(on = this.el.hidden) { this.el.hidden = !on; }
  set(k, v) { this.values[k] = v; this.apply(); this.save(); }
  apply() {
    const f = this.values.fontScale;
    document.documentElement.style.setProperty('--ui-scale', f);
    this.font.value = f; this.fontVal.textContent = `${Math.round(f * 100)}%`;
  }
  load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.values)); } catch { /* storage blocked */ } }
}
