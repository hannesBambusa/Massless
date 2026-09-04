// HTML overlay: HUD numbers, command bar, throttle, overview list, mode toggle. Reads game state, writes DOM, fires callbacks.
import * as THREE from 'three';
import { fmt, fmtDist } from './utils.js';
import { SHIP, WORLD, ENERGY_BY_KEY } from './config.js';
import { DESIGNS } from './ships/index.js';
import { HudFx, setHudDt } from './hudfx.js';

const $ = (id) => document.getElementById(id);
const el = {
  speed: $('hud-speed'), pos: $('hud-pos'), scrap: $('hud-scrap'), shield: $('bar-shield'), hull: $('bar-hull'), help: $('help'),
  cmd: $('cmd'), cmdTitle: $('cmd-title'), cmdDist: $('cmd-dist'), cmdStatus: $('cmd-status'), ranges: $('cmd-ranges'),
  throttle: $('throttle'), throttleNum: $('throttle-num'), overview: $('overview-list'), mode: $('btn-mode'), helpCmd: $('help-command'), helpDirect: $('help-direct'),
  design: $('sel-design'), track: $('btn-track'), flash: $('flash'), hp: $('cmd-hp'), hpFill: $('cmd-hp-fill'), lance: $('btn-lance'), harvest: $('btn-harvest'), weapon: $('weapon-status'), label: $('target-label'), labelName: $('tl-name'), labelDist: $('tl-dist'), labelArrow: $('tl-arrow'),
  gHp: $('g-hp'), gLock: $('g-lock'), gTicks: $('g-ticks'), gSpeed: $('g-speed'),
  yield: $('yield-num'), yieldMax: $('yield-max'), yieldKind: $('yield-kind'), holdList: $('hold-list'), threat: $('threat-name'), threatDist: $('threat-dist'), shieldNum: $('threat-shield'),
};

export class UI {
  constructor(game) {
    this.game = game;
    this.rows = new Map();
    this.overviewTimer = 0;
    window.addEventListener('keydown', (e) => { if (e.code === 'KeyH') el.help.hidden = !el.help.hidden; });
    for (const b of el.cmd.querySelectorAll('[data-cmd]')) b.addEventListener('click', () => game.command(b.dataset.cmd));
    for (const r of SHIP.ranges) {
      const b = document.createElement('button'); b.textContent = r; b.dataset.range = r;
      b.addEventListener('click', () => { game.ship.range = r; if (game.ship.cmd.range) game.ship.cmd.range = r; this.syncRanges(); });
      el.ranges.appendChild(b);
    }
    this.syncRanges();
    el.throttle.addEventListener('input', () => { game.ship.throttle = el.throttle.value / 100; el.throttleNum.textContent = el.throttle.value + '%'; });
    for (const d of DESIGNS) { const o = document.createElement('option'); o.value = d.id; o.textContent = d.name; o.title = d.description; el.design.appendChild(o); }
    el.design.value = game.ship.design;
    el.design.addEventListener('change', () => { game.ship.setDesign(el.design.value); el.design.blur(); });
    el.mode.addEventListener('click', () => game.toggleMode());
    for (const b of document.querySelectorAll('#hud-modes button')) b.addEventListener('click', () => this.lockHud(b.dataset.hud));
    this.setHud('nav', true);
    window.addEventListener('keydown', (e) => {
      if (e.target !== document.body) return;
      if (e.code === 'Digit1') this.lockHud('nav'); if (e.code === 'Digit2') this.lockHud('harvest'); if (e.code === 'Digit3') this.lockHud('combat');
    });
    el.track.addEventListener('click', () => game.toggleTrack());
    this.proj = new THREE.Vector3();
    this.fx = new HudFx();
    // gauge ticks: 24 short radial lines around the outer ring
    for (let i = 0; i < 24; i++) {
      const a = i / 24 * Math.PI * 2, l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      const r0 = i % 6 === 0 ? 52 : 54, r1 = 55.5;
      l.setAttribute('x1', 60 + Math.cos(a) * r0); l.setAttribute('y1', 60 + Math.sin(a) * r0); l.setAttribute('x2', 60 + Math.cos(a) * r1); l.setAttribute('y2', 60 + Math.sin(a) * r1);
      el.gTicks.appendChild(l);
    }
  }
  /** the hold: one row per energy collected, bumping when it grows */
  updateHold() {
    const hold = this.game.state.hold; this.holdRows = this.holdRows || new Map();
    for (const key in hold) {
      const e = ENERGY_BY_KEY[key]; if (!e) continue;
      let row = this.holdRows.get(key);
      if (!row) {
        row = document.createElement('div'); row.className = 'hold-row'; row.style.setProperty('--c', '#' + e.color.toString(16).padStart(6, '0'));
        row.innerHTML = `<i></i><span class="name">${e.name}</span><span class="n">0</span>`;
        el.holdList.appendChild(row); this.holdRows.set(key, row); row.last = 0;
      }
      const n = Math.floor(hold[key]);
      if (n !== row.last) { row.last = n; row.querySelector('.n').textContent = n; row.classList.remove('bump'); void row.offsetWidth; row.classList.add('bump'); }
    }
  }
  /** a manual pick holds the state for a while before the HUD goes back to following the target */
  lockHud(mode) { this.setHud(mode); clearTimeout(this.hudLockT); this.hudLock = true; this.hudLockT = setTimeout(() => { this.hudLock = false; }, 6000); }
  /** morph the HUD into one of its states: nav | harvest | combat */
  setHud(mode, silent = false) {
    if (this.hud === mode) return;
    this.hud = mode;
    document.body.dataset.hud = mode;
    if (this.fx) this.fx.setState(mode);
    for (const b of document.querySelectorAll('#hud-modes button')) b.classList.toggle('on', b.dataset.hud === mode);
    if (!silent) { document.body.classList.remove('morphing'); void document.body.offsetWidth; document.body.classList.add('morphing'); }
  }
  flash(msg) { el.flash.textContent = msg; el.flash.classList.add('on'); clearTimeout(this.flashT); this.flashT = setTimeout(() => el.flash.classList.remove('on'), 2200); }
  setTracking(on) { el.track.classList.toggle('on', on); }
  syncRanges() { for (const b of el.ranges.children) b.classList.toggle('on', +b.dataset.range === this.game.ship.range); }
  setMode(direct) {
    el.mode.textContent = direct ? 'DIRECT' : 'COMMAND';
    el.mode.classList.toggle('on', direct);
    document.body.classList.toggle('direct', direct);
    el.helpCmd.hidden = direct; el.helpDirect.hidden = !direct;
  }

  /** name + distance pinned to the target on screen; clamped to the edge with an arrow when it is off screen */
  updateTargetLabel(obj, camera) {
    el.label.hidden = !obj;
    if (!obj) return;
    const v = this.proj.copy(obj.position).project(camera);
    const behind = v.z > 1;
    let x = (v.x + 1) / 2 * innerWidth, y = (1 - v.y) / 2 * innerHeight;
    if (behind) { x = innerWidth - x; y = innerHeight - y; }
    const pad = 40, off = behind || x < pad || x > innerWidth - pad || y < pad || y > innerHeight - pad;
    if (off) {
      // push the point out along the line from screen centre until it hits the padded edge
      const cx = innerWidth / 2, cy = innerHeight / 2, dx = x - cx, dy = y - cy;
      const k = Math.min((cx - pad) / Math.max(Math.abs(dx), 1e-6), (cy - pad) / Math.max(Math.abs(dy), 1e-6));
      x = cx + dx * k; y = cy + dy * k;
      el.labelArrow.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
    }
    el.label.classList.toggle('off', off);
    el.label.style.left = x + 'px'; el.label.style.top = (y - (off ? 0 : 28)) + 'px';
    el.labelName.textContent = obj.name;
    el.labelDist.textContent = fmtDist(obj.position.distanceTo(this.game.ship.position) - obj.radius, WORLD.auUnits);
  }

  update(dt) {
    const { ship, selection, rocks } = this.game;
    setHudDt(dt);
    el.speed.textContent = Math.round(ship.speed);
    const p = ship.position;
    el.pos.textContent = `${Math.round(p.x)}, ${Math.round(p.y)}, ${Math.round(p.z)}`;
    el.scrap.textContent = fmt(this.game.state.scrap);
    el.shield.style.width = (ship.shield / ship.shieldMax * 100) + '%';
    el.hull.style.width = (ship.hull / ship.hullMax * 100) + '%';
    el.cmdStatus.textContent = ship.describe();
    const lance = this.game.lance;
    el.weapon.textContent = lance.describe();
    el.lance.classList.toggle('on', lance.on); el.harvest.classList.toggle('on', lance.on);

    const sel = selection.obj;
    el.cmd.classList.toggle('has-target', !!sel);
    el.cmd.dataset.kind = sel ? sel.kind : 'none';
    if (sel) { el.cmdTitle.textContent = sel.name; el.cmdDist.textContent = fmtDist(sel.position.distanceTo(p) - sel.radius, WORLD.auUnits); }
    else { el.cmdTitle.textContent = 'No target'; el.cmdDist.textContent = ''; }
    el.hp.hidden = !(sel && sel.hpMax);
    if (sel && sel.hpMax) el.hpFill.style.width = (sel.hp / sel.hpMax * 100) + '%';
    // gauge rings: outer = target hp, inner = lance lock
    const hpF = sel && sel.hpMax ? sel.hp / sel.hpMax : 0;
    el.gHp.style.strokeDashoffset = 314.2 * (1 - hpF);
    el.gLock.style.strokeDashoffset = 238.8 * (1 - (lance.on && lance.target === sel ? lance.lock : 0));
    el.gSpeed.style.strokeDashoffset = 364.4 * (1 - Math.min(1, ship.speed / SHIP.maxSpeed));
    this.fx.update(dt, { hp: hpF, lock: lance.on && lance.target === sel ? lance.lock : 0, speed: Math.min(1, ship.speed / SHIP.maxSpeed), selected: !!sel, hunting: this.game.mobs.list.some((m) => m.hunting) });
    // the HUD follows what you are dealing with: a condensate = harvest, a wisp or a wisp hunting you = combat, else nav
    const threat = this.game.mobs.list.find((m) => m.hunting && m.position.distanceTo(p) < 120);
    const want = (sel && sel.kind === 'mob') || threat ? 'combat' : sel && sel.kind === 'cloud' ? 'harvest' : 'nav';
    if (want !== this.hud && !this.hudLock) this.setHud(want);
    if (this.hud === 'harvest' && sel && sel.hpMax) { el.yield.textContent = Math.round(sel.radius * 4 * (sel.hp / sel.hpMax)); el.yieldMax.textContent = Math.round(sel.radius * 4); if (sel.energy) el.yieldKind.textContent = `${sel.energy.name} bound in the condensate`; }
    this.updateHold();
    if (this.hud === 'combat') { const foe = sel && sel.kind === 'mob' ? sel : threat; el.threat.textContent = foe ? `${foe.name} · ${Math.round(foe.hp)} / ${foe.hpMax}` : 'No hostile locked'; el.threatDist.textContent = foe ? fmtDist(foe.position.distanceTo(p), WORLD.auUnits) : ''; el.shieldNum.textContent = Math.round(ship.shield) + ' / ' + ship.shieldMax; }

    // overview: refresh a few times a second, rows keyed by object
    this.overviewTimer -= dt;
    if (this.overviewTimer > 0) return;
    this.overviewTimer = 0.25;
    const near = rocks.list.map((o) => [o, o.position.distanceTo(p) - o.radius]).filter(([, d]) => d < WORLD.overviewRange).sort((a, b) => a[1] - b[1]).slice(0, 10);
    const far = this.game.sites.list.map((o) => [o, o.position.distanceTo(p) - o.radius]).sort((a, b) => a[1] - b[1]);
    const hostile = this.game.mobs.list.map((o) => [o, o.position.distanceTo(p) - o.radius]).filter(([, d]) => d < WORLD.overviewRange * 1.5).sort((a, b) => a[1] - b[1]);
    const keep = new Set(), order = [];
    for (const [o, d] of [...far, ...hostile, ...near]) {
      let row = this.rows.get(o);
      if (!row) {
        row = document.createElement('div'); row.className = 'ov-row ' + o.kind;
        row.innerHTML = `<span class="ov-node"></span><span class="ov-name"></span><span class="ov-dist"></span><span class="ov-bar"></span>`;
        // select on mouse-down: the list re-sorts while you hold the button, and a moved row would swallow a click
        row.addEventListener('mousedown', (e) => { if (e.button === 0) selection.set(o); });
        row.addEventListener('contextmenu', (e) => { e.preventDefault(); this.game.retarget(o); });
        row.addEventListener('dblclick', () => { selection.set(o); this.game.command('approach'); });
        this.rows.set(o, row);
      }
      row.children[1].textContent = o.name; row.children[2].textContent = fmtDist(d, WORLD.auUnits);
      row.style.setProperty('--f', (1 - Math.min(1, Math.log10(1 + d) / 5)).toFixed(2));   // closer = longer bar
      row.classList.toggle('on', o === sel); row.classList.toggle('hunting', !!o.hunting);
      keep.add(o); order.push(row);
    }
    for (const [o, row] of this.rows) if (!keep.has(o)) { row.remove(); this.rows.delete(o); }
    // only move rows when the order really changed, so the list stays still under the pointer
    const cur = el.overview.children;
    let same = cur.length === order.length;
    for (let i = 0; same && i < order.length; i++) if (cur[i] !== order[i]) same = false;
    if (!same) for (const row of order) el.overview.appendChild(row);
  }
}
