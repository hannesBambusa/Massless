// Codex overlay: the log of firsts, grouped, locked entries shown as hints. Key L.
import { CODEX } from './codex.js';

const $ = (id) => document.getElementById(id);
const hex = (c) => '#' + c.toString(16).padStart(6, '0');

export class CodexUI {
  constructor(game) {
    this.game = game; this.el = $('codex');
    $('btn-codex').addEventListener('click', () => this.toggle());
    $('cx-close').addEventListener('click', () => this.toggle(false));
    this.el.addEventListener('click', (e) => { if (e.target === this.el) this.toggle(false); });
    window.addEventListener('keydown', (e) => { if (e.code === 'KeyL') this.toggle(); else if (e.code === 'Escape' && !this.el.hidden) this.toggle(false); });
    game.codex.onUnlock(() => { $('btn-codex').classList.add('new'); if (!this.el.hidden) this.render(); });
  }
  get open() { return !this.el.hidden; }
  toggle(on = this.el.hidden) { this.el.hidden = !on; if (on) { $('btn-codex').classList.remove('new'); this.render(); } }
  render() {
    const cx = this.game.codex, groups = [...new Set(CODEX.map((c) => c.group))];
    $('cx-count').textContent = `${cx.count} / ${CODEX.length}`;
    $('cx-body').innerHTML = groups.map((g) => { const items = CODEX.filter((c) => c.group === g), n = items.filter((c) => cx.has(c.id)).length; return `<section class="cx-group"><div class="fit-sec">${g} <span class="muted">${n}/${items.length}</span></div><div class="cx-grid">${items.map((c) => cx.has(c.id)
      ? `<div class="cx-entry on" style="--c:${hex(c.color)}"><i></i><div><div class="nm">${c.name}</div><div class="lore">${c.lore}</div></div></div>`
      : `<div class="cx-entry" style="--c:${hex(c.color)}"><i></i><div><div class="nm">Unknown</div><div class="lore">${c.how}</div></div></div>`).join('')}</div></section>`; }).join('');
  }
}
