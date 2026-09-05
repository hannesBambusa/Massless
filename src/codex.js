// Codex: a sector log of firsts. Every entry is unlocked once, stamped, and kept in state.codex. Data and logic only.
import { ENERGY } from './config.js';
import { MOB_TYPES } from './mobtypes.js';
import { SYSTEMS } from './systems.js';
import { DESIGNS } from './ships/index.js';
import { PROFESSIONS } from './skills.js';

const LORE = {
  energy: {
    glacis: 'Cold and slow. The oldest binding; it remembers the dark between stars.',
    sol: 'Warm and radiant. What the first stars gave away and never asked back.',
    cerule: 'Deep and resonant. It hums at the pitch of the lanes.',
    ember: 'Hot and unstable. It wants out of whatever holds it.',
    lumen: 'Pure and rare. The core recognises it as kin.',
    ash: 'What a wisp leaves behind. Still warm, still hungry.',
  },
  mob: {
    wisp: 'The hunter. It closes and bites, and it does not tire.',
    shade: 'The sniper. It keeps its distance and throws its cold at your shield.',
    maw: 'The brute. Slow, heavy, and it shrugs off the pulse.',
    shoal: 'The swarm. Weak alone. They are never alone.',
  },
  system: {
    alpha: 'Alpha Reach. Where the core woke. The gate here is the oldest known.',
    kestrel: 'Kestrel Verge. A gold star and a rich belt, and things that know the belt is rich.',
    umbra: 'Umbra Tessellate. Violet light, folded space, and a seam in it that should not be there.',
  },
};

export const CODEX = [
  ...ENERGY.map((e) => ({ id: `energy.${e.key}`, group: 'Energies', name: e.name, color: e.color, lore: LORE.energy[e.key] || e.desc, how: `Siphon your first ${e.name}` })),
  ...Object.entries(MOB_TYPES).map(([k, m]) => ({ id: `mob.${k}`, group: 'Wisps', name: m.name, color: 0xff5f8a, lore: LORE.mob[k] || '', how: `Unbind a ${m.name}` })),
  ...SYSTEMS.map((s) => ({ id: `system.${s.id}`, group: 'Systems', name: s.name, color: s.star, lore: LORE.system[s.id] || '', how: `Fold to ${s.name}` })),
  { id: 'act.warp', group: 'Flight', name: 'First warp', color: 0x60a5fa, lore: 'Distance is a suggestion.', how: 'Warp to a site' },
  { id: 'act.fold', group: 'Flight', name: 'First fold', color: 0xc084fc, lore: 'The gate takes you apart and puts you back together somewhere else. Mostly.', how: 'Fold to another system' },
  { id: 'act.fit', group: 'Fitting', name: 'First module', color: 0x4ff2ff, lore: 'The shell learns to carry more than itself.', how: 'Fit a module' },
  { id: 'act.harmonic', group: 'Fitting', name: 'First harmonic', color: 0xffd166, lore: 'Two of a kind sing.', how: 'Wake a harmonic set' },
  ...DESIGNS.map((d) => ({ id: `shell.${d.id}`, group: 'Shells', name: d.name, color: 0x9be7ff, lore: d.description, how: `Fly the ${d.name}` })),
  ...PROFESSIONS.map((p) => ({ id: `master.${p.id}`, group: 'Masters', name: `Master ${p.name}`, color: p.color, lore: p.desc, how: `Learn the Master ${p.name} box` })),
];
export const CODEX_BY_ID = Object.fromEntries(CODEX.map((c) => [c.id, c]));

export class Codex {
  constructor(state) { this.state = state; state.codex = state.codex || {}; this.listeners = new Set(); }
  onUnlock(fn) { this.listeners.add(fn); }
  has(id) { return !!this.state.codex[id]; }
  get count() { return Object.keys(this.state.codex).filter((id) => CODEX_BY_ID[id]).length; }
  /** record a first; returns the entry when it was new, else null */
  unlock(id) {
    if (!CODEX_BY_ID[id] || this.state.codex[id]) return null;
    this.state.codex[id] = Date.now();
    const e = CODEX_BY_ID[id]; for (const fn of this.listeners) fn(e);
    return e;
  }
}
