// Training: the game-facing side of skills. Owns the skill state (in game.state so it persists), pays for boxes with
// fragments from the hold, surrenders them, and asks the loadout to recompute stats when the pilot changes.
import { normalizeSkills, learn, surrender, canLearn, canSurrender, pointsUsed, skillTags, PROFESSIONS, BOX_BY_ID, SKILL_CAP } from './skills.js';

export class Training {
  constructor(game) {
    this.game = game;
    game.state.skills = normalizeSkills(game.state.skills);
    this.listeners = new Set();
  }
  /** always the live skills object, so a save reset is seen immediately */
  get s() { if (!this.game.state.skills) this.game.state.skills = normalizeSkills(null); return this.game.state.skills; }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  changed() { if (this.game.saver) this.game.saver.mark(); if (this.game.loadout) this.game.loadout.apply(); for (const fn of this.listeners) fn(); }
  get hold() { return this.game.wallet.totals(); }
  learn(box) {
    const r = canLearn(this.s, box, this.hold); if (!r.ok) return r;
    this.s.learned.push(box.id); for (const k in box.frags) this.game.wallet.spend(k, box.frags[k]);
    this.changed(); if (box.kind === 'master' && this.game.codex) this.game.codex.unlock(`master.${box.prof}`);
    return r;
  }
  surrender(box) { const r = surrender(this.s, box); if (r.ok) this.changed(); return r; }
  check(box) { return canLearn(this.s, box, this.hold); }
  checkSurrender(box) { return canSurrender(this.s, box); }
  has(id) { return this.s.learned.includes(id); }
  hasTag(tag) { return skillTags(this.s).has(tag); }
  get points() { return { used: pointsUsed(this.s), cap: SKILL_CAP }; }
  get professions() { return PROFESSIONS; }
  box(id) { return BOX_BY_ID[id]; }
}
