// Fitting catalog: shells per vessel design, the module list, and the harmonic sets. Data only.
// Stats a shell carries (and modules can touch): integrity (hull), shield, shieldRegen, maxSpeed, lanceDps, lanceRange,
// lockTime, overviewRange, plus the two resources luminosity and coherence.
// Module families are the six bound energies; a module costs fragments of its own family.
import { SHIP, LANCE, WORLD } from './config.js';

const BASE = { integrity: SHIP.hull, shield: SHIP.shield, shieldRegen: SHIP.shieldRegen, maxSpeed: SHIP.maxSpeed, lanceDps: LANCE.dps, lanceRange: LANCE.range, lockTime: LANCE.lockTime, overviewRange: WORLD.overviewRange, harvestYield: 1 };
/** unlock: null = free; { frags: {energy: n} } = bound with fragments; { tag } = granted by a skill box (a master, usually) */
const shell = (id, luminosity, coherence, corona, orbit, core, base = {}, unlock = null) => ({ id, luminosity, coherence, slots: { corona, orbit, core }, base: { ...BASE, ...base }, unlock });

/** one shell per vessel design; the design you fly is the shell you fit */
export const SHELLS = {
  bloom:  shell('bloom',  100, 100, 2, 3, 2),
  prism:  shell('prism',  130,  90, 3, 2, 2, { lanceDps: LANCE.dps * 1.1, maxSpeed: SHIP.maxSpeed * 0.95 }),
  shoal:  shell('shoal',   90, 130, 2, 2, 3, { overviewRange: WORLD.overviewRange * 1.3 }, { frags: { glacis: 120, cerule: 80 } }),
  kite:   shell('kite',    90, 110, 1, 4, 2, { maxSpeed: SHIP.maxSpeed * 1.15, integrity: SHIP.hull * 0.85 }, { frags: { cerule: 150, sol: 60 } }),
  gyre:   shell('gyre',   120, 120, 2, 2, 2, { shieldRegen: SHIP.shieldRegen * 1.3 }, { tag: 'master-wayfarer' }),
  ember:  shell('ember',  150,  80, 3, 1, 3, { lanceDps: LANCE.dps * 1.2, shield: SHIP.shield * 0.8 }, { frags: { ember: 200, ash: 60 } }),
  loom:   shell('loom',   100, 140, 1, 3, 3, { lockTime: LANCE.lockTime * 0.8 }, { frags: { lumen: 80, sol: 120 } }),
  medusa: shell('medusa', 110, 110, 1, 3, 3, { shield: SHIP.shield * 1.3, maxSpeed: SHIP.maxSpeed * 0.9 }, { frags: { glacis: 200, lumen: 40 } }),
  cairn:  shell('cairn',  140, 100, 2, 2, 3, { integrity: SHIP.hull * 1.4, maxSpeed: SHIP.maxSpeed * 0.85 }, { frags: { ember: 150, glacis: 150 } }),
  chord:  shell('chord',  100, 150, 3, 3, 1, { lockTime: LANCE.lockTime * 0.7, lanceRange: LANCE.range * 1.15 }, { tag: 'master-lancer' }),
  nautilus: shell('nautilus', 120, 110, 1, 2, 4, { shieldRegen: SHIP.shieldRegen * 1.5, shield: SHIP.shield * 1.1 }, { tag: 'master-attuner' }),
};

const flat = (stat, value) => ({ stat, value, isPercentage: false });
const pct = (stat, value) => ({ stat, value, isPercentage: true });
const mod = (id, name, slot, family, luminosityCost, coherenceCost, cost, modifiers, desc) => ({ id, name, slot, family, luminosityCost, coherenceCost, cost, modifiers, desc });

/** cost: fragments of the module's own family */
export const MODULES = [
  // corona (high): offence
  mod('sol-focus',     'Sol focus',        'corona', 'sol',    30, 15, 40, [pct('lanceDps', 15)], 'A warmer lance'),
  mod('ember-surge',   'Ember surge',      'corona', 'ember',  40, 10, 40, [pct('lanceDps', 25), pct('lockTime', 15)], 'Hits harder, tunes slower'),
  mod('cerule-reach',  'Cerule reach',     'corona', 'cerule', 25, 20, 40, [pct('lanceRange', 30)], 'The lance carries further'),
  mod('lumen-needle',  'Lumen needle',     'corona', 'lumen',  35, 25, 30, [pct('lockTime', -30)], 'Locks in a blink'),
  // orbit (mid): defence and sensing
  mod('glacis-ward',   'Glacis ward',      'orbit',  'glacis', 20, 25, 40, [pct('shield', 25)], 'A thicker shield'),
  mod('glacis-mend',   'Glacis mend',      'orbit',  'glacis', 15, 30, 40, [pct('shieldRegen', 40)], 'The shield knits faster'),
  mod('cerule-ear',    'Cerule ear',       'orbit',  'cerule', 10, 30, 30, [pct('overviewRange', 50)], 'The core feels further'),
  mod('sol-plating',   'Sol plating',      'orbit',  'sol',    20, 20, 40, [flat('integrity', 40)], 'More hull to lose'),
  mod('ash-veil',      'Ash veil',         'orbit',  'ash',    15, 20, 30, [pct('shield', 10), pct('shieldRegen', 15)], 'What the wisps left, turned to armour'),
  // core (low): engines and capacity
  mod('ember-drive',   'Ember drive',      'core',   'ember',  25, 15, 40, [pct('maxSpeed', 20)], 'Faster, hotter'),
  mod('lumen-lattice', 'Lumen lattice',    'core',   'lumen',  0,  20, 30, [pct('luminosity', 25)], 'More light to spend'),
  mod('cerule-mind',   'Cerule mind',      'core',   'cerule', 20, 0,  30, [pct('coherence', 25)], 'More thought to spend'),
  mod('glacis-keel',   'Glacis keel',      'core',   'glacis', 20, 10, 40, [flat('integrity', 25), pct('maxSpeed', -5)], 'Dense and slow'),
  mod('sol-heart',     'Sol heart',        'core',   'sol',    15, 15, 40, [flat('luminosity', 20), flat('coherence', 10)], 'A warmer core'),
  mod('ash-cinder',    'Ash cinder',       'core',   'ash',    10, 10, 25, [pct('maxSpeed', 8), pct('lanceDps', 5)], 'Restless remains'),
];
for (const m of MODULES) m.base = m.id;   // a plain catalog module is its own base
export const MODULE_BY_ID = Object.fromEntries(MODULES.map((m) => [m.id, m]));

/** grades: the same module bound dim, bright or pure. Modifiers scale, costs do not. Grade is rolled where you bind it. */
export const GRADES = { dim: { mult: 0.7, name: 'Dim', color: 0x7d8bb0 }, bright: { mult: 1, name: 'Bright', color: 0x9be7ff }, pure: { mult: 1.4, name: 'Pure', color: 0xffffff } };
/** grade odds by system tier */
export const GRADE_ODDS = { 1: { dim: 0.5, bright: 0.5 }, 2: { dim: 0.2, bright: 0.6, pure: 0.2 }, 3: { bright: 0.5, pure: 0.5 } };
const graded = new Map();
/** the graded variant of a catalog module: id `${base}@${grade}`; bright is the catalog module itself */
export function gradedModule(base, grade) {
  if (grade === 'bright') return base;
  const id = `${base.id}@${grade}`; if (graded.has(id)) return graded.get(id);
  const g = GRADES[grade], m = { ...base, id, base: base.id, grade, name: `${g.name} ${base.name.toLowerCase()}`, modifiers: base.modifiers.map((x) => ({ ...x, value: Math.round(x.value * g.mult * 10) / 10 })) };
  graded.set(id, m); return m;
}
/** resolve any module id, graded or not */
export function moduleById(id) { if (!id) return null; const [b, grade] = id.split('@'); const base = MODULE_BY_ID[b]; return base ? (grade ? gradedModule(base, grade) : base) : null; }
/** a lookup object the fitting engine's deserialize can read graded ids from */
export const MODULE_LOOKUP = new Proxy({}, { get: (_, id) => moduleById(id), has: (_, id) => !!moduleById(id) });
/** blueprints known from the start; everything else drops */
export const STARTER_BLUEPRINTS = ['sol-focus', 'glacis-ward', 'ember-drive', 'cerule-ear', 'sol-heart'];

/** harmonic sets: fit `count` online modules of a family */
export const SETS = [
  { id: 'sol-2',    family: 'sol',    count: 2, name: 'Sol harmony',    modifiers: [pct('lanceDps', 10)], desc: '+10% lance' },
  { id: 'sol-3',    family: 'sol',    count: 3, name: 'Sol chorus',     modifiers: [pct('lanceDps', 10), pct('integrity', 10)], desc: '+10% lance, +10% integrity' },
  { id: 'glacis-2', family: 'glacis', count: 2, name: 'Glacis harmony', modifiers: [pct('shield', 15)], desc: '+15% shield' },
  { id: 'glacis-3', family: 'glacis', count: 3, name: 'Glacis chorus',  modifiers: [pct('shieldRegen', 30)], desc: '+30% shield regen' },
  { id: 'cerule-2', family: 'cerule', count: 2, name: 'Cerule harmony', modifiers: [pct('overviewRange', 25), pct('lanceRange', 10)], desc: '+25% overview, +10% lance range' },
  { id: 'ember-2',  family: 'ember',  count: 2, name: 'Ember harmony',  modifiers: [pct('maxSpeed', 10)], desc: '+10% speed' },
  { id: 'ember-3',  family: 'ember',  count: 3, name: 'Ember chorus',   modifiers: [pct('lanceDps', 15), pct('shield', -10)], desc: '+15% lance, -10% shield' },
  { id: 'lumen-2',  family: 'lumen',  count: 2, name: 'Lumen harmony',  modifiers: [pct('luminosity', 10), pct('coherence', 10)], desc: '+10% both resources' },
  { id: 'ash-2',    family: 'ash',    count: 2, name: 'Ash harmony',    modifiers: [pct('lockTime', -15)], desc: '-15% lock time' },
];

export const STAT_LABELS = { integrity: 'Integrity', shield: 'Shield', shieldRegen: 'Shield regen', maxSpeed: 'Speed', lanceDps: 'Lance', lanceRange: 'Lance range', lockTime: 'Lock time', overviewRange: 'Overview', harvestYield: 'Yield', luminosity: 'Luminosity', coherence: 'Coherence' };
export const SLOT_LABELS = { corona: 'Corona', orbit: 'Orbit', core: 'Core' };
