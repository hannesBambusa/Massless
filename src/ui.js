// HTML overlay: HUD numbers, command bar, throttle, overview list, mode toggle. Reads game state, writes DOM, fires callbacks.
import * as THREE from 'three';
import { fmt, fmtDist } from './utils.js';
import { SHIP, WORLD } from './config.js';
import { DESIGNS } from './ships/index.js';

const $ = (id) => document.getElementById(id);
const el = {
  speed: $('hud-speed'), pos: $('hud-pos'), scrap: $('hud-scrap'), shield: $('bar-shield'), hull: $('bar-hull'), help: $('help'),
  cmd: $('cmd'), cmdTitle: $('cmd-title'), cmdDist: $('cmd-dist'), cmdStatus: $('cmd-status'), ranges: $('cmd-ranges'),
  throttle: $('throttle'), throttleNum: $('throttle-num'), overview: $('overview-list'), mode: $('btn-mode'), helpCmd: $('help-command'), helpDirect: $('help-direct'),
  design: $('sel-design'), track: $('btn-track'), flash: $('flash'), hp: $('cmd-hp'), hpFill: $('cmd-hp-fill'), lance: $('btn-lance'), weapon: $('weapon-status'), label: $('target-label'), labelName: $('tl-name'), labelDist: $('tl-dist'), labelArrow: $('tl-arrow'),
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
    el.track.addEventListener('click', () => game.toggleTrack());
    this.proj = new THREE.Vector3();
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
    el.speed.textContent = Math.round(ship.speed);
    const p = ship.position;
    el.pos.textContent = `${Math.round(p.x)}, ${Math.round(p.y)}, ${Math.round(p.z)}`;
    el.scrap.textContent = fmt(this.game.state.scrap);
    el.shield.style.width = (ship.shield / ship.shieldMax * 100) + '%';
    el.hull.style.width = (ship.hull / ship.hullMax * 100) + '%';
    el.cmdStatus.textContent = ship.describe();
    const lance = this.game.lance;
    el.weapon.textContent = lance.describe();
    el.lance.classList.toggle('on', lance.on);

    const sel = selection.obj;
    el.cmd.classList.toggle('has-target', !!sel);
    if (sel) { el.cmdTitle.textContent = sel.name; el.cmdDist.textContent = fmtDist(sel.position.distanceTo(p) - sel.radius, WORLD.auUnits); }
    else { el.cmdTitle.textContent = 'No target'; el.cmdDist.textContent = ''; }
    el.hp.hidden = !(sel && sel.hpMax);
    if (sel && sel.hpMax) el.hpFill.style.width = (sel.hp / sel.hpMax * 100) + '%';

    // overview: refresh a few times a second, rows keyed by object
    this.overviewTimer -= dt;
    if (this.overviewTimer > 0) return;
    this.overviewTimer = 0.25;
    const near = rocks.list.map((o) => [o, o.position.distanceTo(p) - o.radius]).filter(([, d]) => d < WORLD.overviewRange).sort((a, b) => a[1] - b[1]).slice(0, 10);
    const far = this.game.sites.list.map((o) => [o, o.position.distanceTo(p) - o.radius]).sort((a, b) => a[1] - b[1]);
    const keep = new Set();
    for (const [o, d] of [...far, ...near]) {
      let row = this.rows.get(o);
      if (!row) {
        row = document.createElement('div'); row.className = 'ov-row' + (o.kind === 'site' ? ' site' : '');
        row.innerHTML = `<span class="ov-name"></span><span class="ov-dist"></span>`;
        row.addEventListener('click', () => selection.set(o));
        row.addEventListener('contextmenu', (e) => { e.preventDefault(); this.game.retarget(o); });
        row.addEventListener('dblclick', () => { selection.set(o); this.game.command('approach'); });
        this.rows.set(o, row);
      }
      row.firstChild.textContent = o.name; row.lastChild.textContent = fmtDist(d, WORLD.auUnits);
      row.classList.toggle('on', o === sel);
      el.overview.appendChild(row); keep.add(o);
    }
    for (const [o, row] of this.rows) if (!keep.has(o)) { row.remove(); this.rows.delete(o); }
  }
}
