// Fitting overlay: a map of the shell. Resources are two columns on the left, slots are hex nodes on three rings around
// a glowing core (Corona outer arc, Orbit sides, Core cluster), harmonics are a card on the right and the module drawer
// under it lists what fits the selected slot type. Reads the loadout, writes DOM.
import { ENERGY_BY_KEY } from './config.js';
import { SLOT_LABELS, STAT_LABELS } from './fits.js';
import { SLOTS, baseStats } from './fitting.js';
import { DESIGNS } from './ships/index.js';
import { TAU } from './utils.js';

const $ = (id) => document.getElementById(id);
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const fam = (key) => ENERGY_BY_KEY[key] || { name: key, color: 0x7d8bb0 };
const fmtStat = (k, v) => k === 'lockTime' ? `${v.toFixed(2)} s` : k === 'shieldRegen' || k === 'lanceDps' ? `${v.toFixed(1)}/s` : k === 'lanceRange' || k === 'overviewRange' ? (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)} km` : `${Math.round(v)} m`) : Math.round(v).toString();
const LOWER_BETTER = new Set(['lockTime']);
const RING = { corona: 250, orbit: 172, core: 92 };          // ring radii in the map's 600-unit viewBox
const SLOT_COLOR = { corona: 'var(--corona)', orbit: 'var(--orbit)', core: 'var(--corecol)' };
const deg = (d) => d / 360 * TAU;

/** angles (radians, 0 = right, clockwise in screen space) for n nodes of a slot type */
function angles(slot, n) {
  if (n === 0) return [];
  if (slot === 'corona') { const a0 = deg(-90) - deg(28) * (n - 1) / 2; return Array.from({ length: n }, (_, i) => a0 + deg(28) * i); }          // an arc over the top
  if (slot === 'orbit') {   // alternate left and right, fanning out from the horizontal
    const out = []; for (let i = 0; i < n; i++) { const side = i % 2 ? deg(180) : 0, k = Math.floor(i / 2), off = deg(30) * (k % 2 ? -1 : 1) * Math.ceil(k / 2); out.push(side + (i % 2 ? -off : off)); } return out;
  }
  const a0 = deg(90); return Array.from({ length: n }, (_, i) => a0 + TAU * i / n);   // core: a full ring starting at the bottom
}

export class FitUI {
  constructor(game, flash) {
    this.game = game; this.lo = game.loadout; this.flash = flash; this.sel = 'corona';
    this.el = $('fitting'); this.list = $('fit-list'); this.map = $('fit-map');
    $('btn-fit').addEventListener('click', () => this.toggle());
    $('fit-close').addEventListener('click', () => this.toggle(false));
    this.el.addEventListener('click', (e) => { if (e.target === this.el) this.toggle(false); });
    window.addEventListener('keydown', (e) => { if (e.code === 'KeyG') this.toggle(); else if (e.code === 'Escape' && !this.el.hidden) this.toggle(false); });
    window.addEventListener('resize', () => { if (!this.el.hidden) this.render(); });
    this.lo.onChange(() => { if (!this.el.hidden) this.render(); });
    this.list.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const m = this.lo.modules.find((x) => x.id === b.dataset.id); if (!m) return;
      const r = b.dataset.act === 'buy' ? this.lo.buy(m) : this.lo.fit(m);
      this.flash(r.ok ? (b.dataset.act === 'buy' ? `${m.name} bound` : `${m.name} fitted`) : r.reason);
      this.render();
    });
    $('fit-slots').addEventListener('click', (e) => {
      const h = e.target.closest('.hex'); if (!h) return;
      this.sel = h.dataset.slot;
      if (h.classList.contains('filled')) {
        const r = this.lo.unfit(h.dataset.slot, +h.dataset.index);
        if (r.module) this.flash(r.offlined.length ? `${r.module.name} unfitted, ${r.offlined.map((m) => m.name).join(', ')} went dark` : `${r.module.name} unfitted`);
      }
      this.render();
    });
  }
  get open() { return !this.el.hidden; }
  toggle(on = this.el.hidden) { this.el.hidden = !on; if (on) this.render(); }

  render() {
    const lo = this.lo, shell = lo.shell, r = lo.result, design = DESIGNS.find((d) => d.id === shell.id);
    $('fit-shell').textContent = design ? design.name : shell.id;

    // resource columns
    const col = (key, cls, label, sub) => { const u = r.usage[key], c = r.capacity[key], f = c ? Math.min(1, u / c) : 0, over = u > c + 1e-9; return `<div class="rcol ${cls} ${over ? 'over' : ''}"><span class="ico"></span><div class="column"><div class="fill" style="--f:${f}"></div><div class="side"><b>${label}</b><span>${over ? 'over capacity' : f > 0.9 ? 'near capacity' : sub}</span></div></div><span class="ico"></span><span class="num">${Math.round(u)}<span>/${Math.round(c)}</span></span></div>`; };
    $('fit-res').innerHTML = col('luminosity', 'lum', 'Luminosity', 'light to spend') + col('coherence', 'coh', 'Coherence', 'signal stable');

    // derived stats vs the bare shell
    const base = baseStats(shell);
    $('fit-stats').innerHTML = Object.keys(STAT_LABELS).map((k) => { const v = r.stats[k], b = base[k], d = Math.abs(v - b) < 1e-6 ? '' : ((v > b) !== LOWER_BETTER.has(k) ? 'up' : 'down'); return `<div class="stat-row"><span class="k">${STAT_LABELS[k]}</span><span class="v ${d}">${fmtStat(k, v)}</span></div>`; }).join('');

    // the map: rings in the svg, hex nodes positioned in px from the centre
    const W = this.map.clientWidth, H = this.map.clientHeight, k = Math.min(W, H) / 600;
    const svg = this.map.querySelector('.fit-rings');
    let paths = '';
    for (const s of SLOTS) paths += `<circle class="r-${s}" r="${RING[s]}"/><circle class="r-${s} faint" r="${RING[s] + 14}"/>`;
    paths += `<circle class="r-core faint" r="${RING.core - 24}"/>`;
    let nodes = '';
    for (const s of SLOTS) {
      const cells = shell.equipped[s], an = angles(s, cells.length);
      cells.forEach((c, i) => {
        const x = Math.cos(an[i]) * RING[s], y = Math.sin(an[i]) * RING[s];
        paths += `<line class="spoke" x1="${(x * 0.35).toFixed(1)}" y1="${(y * 0.35).toFixed(1)}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`;
        const pos = `--x:${(x * k).toFixed(1)}px; --y:${(y * k).toFixed(1)}px;`;
        const sel = this.sel === s && !c ? 'sel' : '';
        nodes += c
          ? `<div class="hex filled ${c.online ? '' : 'dark'}" style="${pos} --c:${hex(fam(c.module.family).color)}" data-slot="${s}" data-index="${i}" title="${c.module.desc}. Click to unfit"><span class="shape"></span><span class="glyph"></span><span class="tag">${c.module.name}</span></div>`
          : `<div class="hex empty ${sel}" style="${pos} --c:${SLOT_COLOR[s]}" data-slot="${s}" data-index="${i}" title="Empty ${SLOT_LABELS[s]} node. Click to browse modules"><span class="shape"></span><span class="plus">+</span></div>`;
      });
    }
    svg.innerHTML = paths; $('fit-slots').innerHTML = nodes;

    // harmonics: active sets lit, the rest dimmed with progress
    const counts = {}; for (const s of SLOTS) for (const c of shell.equipped[s]) if (c && c.online) counts[c.module.family] = (counts[c.module.family] || 0) + 1;
    const activeIds = new Set(r.sets.map((a) => a.set.id));
    const rows = lo.sets.map((s) => ({ s, on: activeIds.has(s.id), have: counts[s.family] || 0 })).filter((x) => x.on || x.have > 0);
    $('fit-sets').innerHTML = rows.length ? rows.map(({ s, on, have }) => `<div class="set-row ${on ? 'on' : 'off'}" style="--c:${hex(fam(s.family).color)}"><i></i><span class="name">${s.name}</span><span class="cnt">${Math.min(have, s.count)}/${s.count}</span><span class="desc">${s.desc}</span></div>`).join('') : `<div class="harm-empty">Fit two modules of one family to wake a harmonic</div>`;

    // drawer: modules for the selected slot type
    $('fit-drawer-head').textContent = `${SLOT_LABELS[this.sel]} modules`;
    this.list.innerHTML = lo.modules.filter((m) => m.slot === this.sel).map((m) => {
      const f = fam(m.family), have = lo.fragments(m), own = lo.owned(m.id), chk = own ? lo.check(m) : null;
      const mods = m.modifiers.map((x) => `${x.value > 0 ? '+' : ''}${x.value}${x.isPercentage ? '%' : ''} ${STAT_LABELS[x.stat] || x.stat}`).join(', ');
      return `<div class="mod-row" style="--c:${hex(f.color)}"><span class="node"></span><span class="name">${m.name}<small>${mods}</small><small>${m.luminosityCost} lum · ${m.coherenceCost} coh · <b class="${have < m.cost ? 'poor' : ''}">${m.cost} ${f.name}</b> (${have} held)</small></span><span class="act">${own ? `<span class="own">×${own} held</span>` : ''}<span><button data-act="buy" data-id="${m.id}" ${have < m.cost ? 'disabled' : ''}>Bind</button> <button class="fit" data-act="fit" data-id="${m.id}" ${own && chk.ok ? '' : 'disabled'}>Fit</button></span></span>${chk && !chk.ok ? `<span class="why">${chk.reason}</span>` : ''}</div>`;
    }).join('');
  }
}
