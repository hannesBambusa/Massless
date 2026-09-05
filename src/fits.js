// Fitting catalog: shells per vessel design, the module list, and the harmonic sets. Data only.
// Stats a shell carries (and modules can touch): integrity (hull), shield, shieldRegen, maxSpeed, lanceDps, lanceRange,
// lockTime, overviewRange, plus the two resources luminosity and coherence.
// Module families are the six bound energies; a module costs fragments of its own family.
import { SHIP, LANCE, WORLD } from './config.js';

const BASE = { integrity: SHIP.hull, shield: SHIP.shield, shieldRegen: SHIP.shieldRegen, maxSpeed: SHIP.maxSpeed, lanceDps: LANCE.dps, lanceRange: LANCE.range, lockTime: LANCE.lockTime, overviewRange: WORLD.overviewRange };
const shell = (id, luminosity, coherence, corona, orbit, core, base = {}) => ({ id, luminosity, coherence, slots: { corona, orbit, core }, base: { ...BASE, ...base } });

/** one shell per vessel design; the design you fly is the shell you fit */
export const SHELLS = {
  bloom:  shell('bloom',  100, 100, 2, 3, 2),
  prism:  shell('prism',  130,  90, 3, 2, 2, { lanceDps: LANCE.dps * 1.1, maxSpeed: SHIP.maxSpeed * 0.95 }),
  shoal:  shell('shoal',   90, 130, 2, 2, 3, { overviewRange: WORLD.overviewRange * 1.3 }),
  kite:   shell('kite',    90, 110, 1, 4, 2, { maxSpeed: SHIP.maxSpeed * 1.15, integrity: SHIP.hull * 0.85 }),
  gyre:   shell('gyre',   120, 120, 2, 2, 2, { shieldRegen: SHIP.shieldRegen * 1.3 }),
  ember:  shell('ember',  150,  80, 3, 1, 3, { lanceDps: LANCE.dps * 1.2, shield: SHIP.shield * 0.8 }),
  loom:   shell('loom',   100, 140, 1, 3, 3, { lockTime: LANCE.lockTime * 0.8 }),
  medusa: shell('medusa', 110, 110, 1, 3, 3, { shield: SHIP.shield * 1.3, maxSpeed: SHIP.maxSpeed * 0.9 }),
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
export const MODULE_BY_ID = Object.fromEntries(MODULES.map((m) => [m.id, m]));

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

export const STAT_LABELS = { integrity: 'Integrity', shield: 'Shield', shieldRegen: 'Shield regen', maxSpeed: 'Speed', lanceDps: 'Lance', lanceRange: 'Lance range', lockTime: 'Lock time', overviewRange: 'Overview', luminosity: 'Luminosity', coherence: 'Coherence' };
export const SLOT_LABELS = { corona: 'Corona', orbit: 'Orbit', core: 'Core' };
