// Loadout: the game-facing side of fitting. Owns one shell per vessel design, the module inventory, buying with
// fragments, and pushing derived stats into the ship. State lives in game.state (fits, owned) so the saver persists it.
import { SHELLS, MODULES, MODULE_BY_ID, SETS } from './fits.js';
import { newShell, equip, unequip, canEquip, calcStats, relight, serialize, deserialize } from './fitting.js';
import { skillModifiers, skillTags } from './skills.js';

export class Loadout {
  constructor(game) {
    this.game = game; this.state = game.state; this.shells = {};
    this.listeners = new Set();
    for (const id in SHELLS) this.shells[id] = deserialize(newShell(SHELLS[id]), this.state.fits[id], MODULE_BY_ID);
    game.ship.onDesign = () => this.apply();
    this.apply();
  }
  get shell() { return this.shells[this.game.ship.design] || this.shells.bloom; }

  /** shells: free, bought with fragments, or granted by a skill tag */
  unlockOf(id) { return SHELLS[id] ? SHELLS[id].unlock : null; }
  unlocked(id) {
    const u = this.unlockOf(id); if (!u) return true;
    if (this.state.shells && this.state.shells[id]) return true;
    if (u.tag && this.state.skills && skillTags(this.state.skills).has(u.tag)) return true;
    return false;
  }
  canUnlock(id) {
    const u = this.unlockOf(id);
    if (!u || this.unlocked(id)) return { ok: false, reason: 'Already yours' };
    if (u.tag) return { ok: false, reason: `Granted by the ${u.tag.replace('master-', 'Master ')} box` };
    const short = Object.entries(u.frags).filter(([k, n]) => Math.floor(this.state.hold[k] || 0) < n);
    if (short.length) return { ok: false, reason: `Needs ${short.map(([k, n]) => `${n} ${k} (${Math.floor(this.state.hold[k] || 0)} held)`).join(', ')}` };
    return { ok: true };
  }
  unlock(id) {
    const r = this.canUnlock(id); if (!r.ok) return r;
    for (const [k, n] of Object.entries(this.unlockOf(id).frags)) this.state.hold[k] -= n;
    this.state.shells = this.state.shells || {}; this.state.shells[id] = true;
    if (this.game.saver) this.game.saver.mark();
    for (const fn of this.listeners) fn(this.result);
    return r;
  }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  /** recompute stats for the current shell, push them into the ship, persist */
  apply() {
    const r = calcStats(this.shell, SETS, this.state.skills ? skillModifiers(this.state.skills) : []);
    this.result = r;
    this.game.ship.applyStats(r.stats);
    if (this.game.codex) { if (r.sets.length) this.game.codex.unlock('act.harmonic'); if (Object.values(this.shell.equipped).some((a) => a.some(Boolean))) this.game.codex.unlock('act.fit'); this.game.codex.unlock(`shell.${this.shell.id}`); }
    this.state.fits[this.shell.id] = serialize(this.shell);
    if (this.game.saver) this.game.saver.mark();
    for (const fn of this.listeners) fn(r);
    return r;
  }

  owned(id) { return this.state.owned[id] || 0; }
  /** fragments of a module's family the player holds */
  fragments(module) { return Math.floor(this.state.hold[module.family] || 0); }
  canBuy(module) { return this.fragments(module) >= module.cost; }
  buy(module) {
    if (!this.canBuy(module)) return { ok: false, reason: `Needs ${module.cost} ${module.family} fragments` };
    this.state.hold[module.family] -= module.cost;
    this.state.owned[module.id] = this.owned(module.id) + 1;
    this.apply();
    return { ok: true };
  }
  /** equip one owned module into its slot type; returns the engine result */
  fit(module) {
    if (this.owned(module.id) < 1) return { ok: false, reason: 'None in the hold' };
    const r = equip(this.shell, module, module.slot);
    if (r.ok) { this.state.owned[module.id]--; relight(this.shell); this.apply(); }
    return r;
  }
  check(module) { return canEquip(this.shell, module, module.slot); }
  /** pull a module out of a slot back into the inventory; anything that went dark is reported */
  unfit(slot, index) {
    const r = unequip(this.shell, slot, index);
    if (r.module) { this.state.owned[r.module.id] = this.owned(r.module.id) + 1; this.apply(); }
    return r;
  }
  /** try to bring dark modules back after capacity grew */
  relight() { const back = relight(this.shell); if (back.length) this.apply(); return back; }
  get modules() { return MODULES; }
  get sets() { return SETS; }
}
