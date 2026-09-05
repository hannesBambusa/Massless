// Skills overlay: profession tabs, a tree of boxes (novice at the root, four branches of four tiers, master on top),
// an experience card and an info card with learn / surrender. Reads the training manager, writes DOM.
import { STAT_LABELS } from './fits.js';
import { ENERGY_BY_KEY } from './config.js';
import { MASTER_LUMEN } from './skills.js';

const $ = (id) => document.getElementById(id);
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const fam = (k) => ENERGY_BY_KEY[k] || { name: k, color: 0x7d8bb0 };
const fmtMod = (x) => `${x.value > 0 ? '+' : ''}${x.value}${x.isPercentage ? '%' : ''} ${STAT_LABELS[x.stat] || x.stat}`;

export class SkillUI {
  constructor(game, flash) {
    this.game = game; this.tr = game.training; this.flash = flash;
    this.el = $('skills'); this.prof = this.tr.professions[0].id; this.sel = null;
    $('btn-skills').addEventListener('click', () => this.toggle());
    $('sk-close').addEventListener('click', () => this.toggle(false));
    this.el.addEventListener('click', (e) => { if (e.target === this.el) this.toggle(false); });
    window.addEventListener('keydown', (e) => { if (e.code === 'KeyK') this.toggle(); else if (e.code === 'Escape' && !this.el.hidden) this.toggle(false); });
    this.tr.onChange(() => { if (!this.el.hidden) this.render(); });
    $('sk-tabs').addEventListener('click', (e) => { const t = e.target.closest('.sk-tab'); if (t) { this.prof = t.dataset.id; this.sel = null; this.render(); } });
    $('sk-tree').addEventListener('click', (e) => { const b = e.target.closest('.box'); if (b) { this.sel = b.dataset.id; this.render(); } });
    $('sk-info').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b || !this.sel) return;
      const box = this.tr.box(this.sel);
      const r = b.dataset.act === 'learn' ? this.tr.learn(box) : this.tr.surrender(box);
      this.flash(r.ok ? (b.dataset.act === 'learn' ? `Learned ${box.name}` : `Surrendered ${box.name}`) : r.reason);
      this.render();
    });
  }
  get open() { return !this.el.hidden; }
  toggle(on = this.el.hidden) { this.el.hidden = !on; if (on) this.render(); }

  render() {
    const tr = this.tr, s = tr.s, prof = tr.professions.find((p) => p.id === this.prof), col = hex(prof.color);
    const pts = tr.points;
    $('sk-points').innerHTML = `<span>Skill points <b>${pts.used}</b> / ${pts.cap}</span><span class="track"><i style="--f:${pts.used / pts.cap}"></i></span>`;
    $('sk-tabs').innerHTML = tr.professions.map((p) => { const n = p.boxes.filter((b) => tr.has(b.id)).length; return `<button class="sk-tab ${p.id === this.prof ? 'on' : ''}" data-id="${p.id}" style="--c:${hex(p.color)}"><i></i>${p.name}<small>${n}/${p.boxes.length}</small></button>`; }).join('');

    // tree
    const cls = (b) => { const known = tr.has(b.id); const chk = known ? null : tr.check(b); return `box ${b.kind} ${known ? 'known' : chk.ok ? 'ready' : chk.code === 'prereq' ? 'locked' : ''} ${b.id === this.sel ? 'sel' : ''} t${b.tier}`; };
    const node = (b, extra = '') => `<div class="${cls(b)} ${extra}" data-id="${b.id}"><span class="hexn"><i></i></span><span class="txt"><span class="nm">${b.name}</span><span class="ct">${b.cost} pts${Object.entries(b.frags).map(([k, n]) => ` · ${n} ${fam(k).name}`).join('')}</span></span></div>`;
    let tree = '';
    const master = prof.boxes.find((b) => b.kind === 'master'), novice = prof.boxes.find((b) => b.kind === 'novice');
    tree += `<div class="sk-master">${node(master, 'big')}</div>`;
    prof.branches.forEach((br, i) => { tree += `<div class="sk-branch-head" style="grid-column:${i + 1}">${br.name}</div>`; });
    for (let t = 4; t >= 1; t--) prof.branches.forEach((br, i) => { const b = prof.boxes.find((x) => x.branch === br.key && x.tier === t); tree += `<div style="grid-column:${i + 1}; grid-row:${6 - t}; display:flex; align-items:center;">${node(b)}</div>`; });
    tree += `<div class="sk-novice">${node(novice, 'big')}</div>`;
    const treeEl = $('sk-tree'); treeEl.style.setProperty('--c', col); treeEl.innerHTML = tree;

    // fragments card: what the hold has of each energy a profession is paid in, against the next box that needs it
    const hold = tr.hold;
    const xpRow = (name, color, have, need) => `<div class="xp-row" style="--c:${hex(color)}"><span class="k">${name}</span><span class="track"><i style="--f:${need ? Math.min(1, have / need) : 1}"></i></span><span class="v">${have.toLocaleString()}${need ? ` / ${need}` : ''}</span></div>`;
    const rows = tr.professions.map((p) => {
      const next = p.boxes.filter((b) => !tr.has(b.id) && b.frags[p.energy]).sort((a, b) => a.frags[p.energy] - b.frags[p.energy])[0];
      return xpRow(fam(p.energy).name, fam(p.energy).color, Math.floor(hold[p.energy] || 0), next ? next.frags[p.energy] : 0);
    });
    rows.push(xpRow('Lumen', fam('lumen').color, Math.floor(hold.lumen || 0), MASTER_LUMEN));
    $('sk-xp').innerHTML = rows.join('');

    // info card
    const box = this.sel ? tr.box(this.sel) : null;
    $('sk-info-head').textContent = box ? (box.kind === 'branch' ? box.branchName : prof.name) : 'Box';
    if (!box) { $('sk-info').innerHTML = `<div class="sk-empty">Pick a box. ${prof.desc}</div>`; return; }
    const known = tr.has(box.id), chk = known ? tr.checkSurrender(box) : tr.check(box);
    const req = box.requires.map((r) => `<span class="${tr.has(r) ? '' : 'bad'}">needs <b>${tr.box(r).name}</b></span>`).join('');
    $('sk-info').innerHTML = `<div class="sk-info" style="--c:${col}"><div class="nm">${box.name}</div><div class="ds">${box.desc}</div>
      <div class="mods">${box.modifiers.map((m) => `<span><b>${fmtMod(m)}</b></span>`).join('')}${box.tags.length ? `<span class="muted">unlocks: ${box.tags.join(', ')}</span>` : ''}</div>
      <div class="req"><span>costs <b>${box.cost}</b> skill points${Object.entries(box.frags).map(([k, n]) => ` and <b>${n}</b> ${fam(k).name}`).join('')}</span>${req}</div>
      <div class="act">${known ? `<button data-act="surrender" ${chk.ok ? '' : 'disabled'}>Surrender</button>` : `<button class="learn" data-act="learn" ${chk.ok ? '' : 'disabled'}>Learn</button>`}</div>
      ${chk.ok ? '' : `<div class="why">${chk.reason}</div>`}</div>`;
  }
}
