// Skill system, Star Wars Galaxies style. Pure data and logic, no DOM.
// A profession is a novice box, four branches of four tiers, and a master box. Boxes cost skill points from one shared
// budget (SKILL_CAP) and fragments from the hold: each profession is paid in one bound energy, the master box also in
// Lumen. A tier needs the tier below it; branch tier 1 needs the novice box; master needs every branch's tier 4.
// Surrendering a box refunds its points, never its fragments, and needs its dependents gone.
// Boxes carry stat modifiers in the fitting engine's format, so they stack with modules and harmonics.

export const SKILL_CAP = 250;
const TIER_COST = [15, 6, 8, 10, 12];          // novice, tier 1..4 (skill points)
const MASTER_COST = 30;
const TIER_FRAGS = [0, 20, 50, 120, 250];      // novice, tier 1..4 (fragments of the profession's energy)
const MASTER_FRAGS = 500, MASTER_LUMEN = 120;
const pct = (stat, value) => ({ stat, value, isPercentage: true });
const flat = (stat, value) => ({ stat, value, isPercentage: false });

/** build a profession from a compact spec: branches list { key, name, tiers: [name x4], mod(tier) -> modifiers } */
function profession(id, name, energy, desc, color, novice, branches, master) {
  const boxes = [];
  boxes.push({ id: `${id}.novice`, prof: id, kind: 'novice', name: `Novice ${name}`, tier: 0, cost: TIER_COST[0], frags: {}, requires: [], modifiers: novice.modifiers, tags: novice.tags || [], desc: novice.desc });
  for (const b of branches) for (let t = 1; t <= 4; t++) {
    boxes.push({ id: `${id}.${b.key}.${t}`, prof: id, kind: 'branch', branch: b.key, branchName: b.name, name: b.tiers[t - 1], tier: t, cost: TIER_COST[t], frags: { [energy]: TIER_FRAGS[t] }, requires: [t === 1 ? `${id}.novice` : `${id}.${b.key}.${t - 1}`], modifiers: b.mod(t), tags: (b.tags && b.tags[t - 1]) ? [b.tags[t - 1]] : [], desc: b.desc });
  }
  boxes.push({ id: `${id}.master`, prof: id, kind: 'master', name: `Master ${name}`, tier: 5, cost: MASTER_COST, frags: { [energy]: MASTER_FRAGS, lumen: MASTER_LUMEN }, requires: branches.map((b) => `${id}.${b.key}.4`), modifiers: master.modifiers, tags: master.tags || [], desc: master.desc });
  return { id, name, energy, desc, color, branches: branches.map((b) => ({ key: b.key, name: b.name })), boxes };
}

export const PROFESSIONS = [
  profession('attuner', 'Attuner', 'sol', 'Reads the bound energies and draws them out. Paid in Sol.', 0xffd166,
    { desc: 'The basics of the siphon', modifiers: [pct('harvestYield', 5)], tags: [] },
    [
      { key: 'siphon', name: 'Siphon', desc: 'Siphoning pulls more from each condensate', tiers: ['Steady siphon', 'Deep siphon', 'Resonant siphon', 'Total siphon'], mod: (t) => [pct('harvestYield', 6 * t)] },
      { key: 'sense', name: 'Sense', desc: 'The core feels further', tiers: ['Keen sense', 'Far sense', 'Wide sense', 'Total sense'], mod: (t) => [pct('overviewRange', 12 * t)] },
      { key: 'tuning', name: 'Tuning', desc: 'The lance tunes faster to clouds and wisps alike', tiers: ['Quick tuning', 'Sure tuning', 'Fine tuning', 'Perfect tuning'], mod: (t) => [pct('lockTime', -6 * t)] },
      { key: 'hold', name: 'Hold', desc: 'More light and thought to spend on the fit', tiers: ['Wider hold', 'Deep hold', 'Vast hold', 'Boundless hold'], mod: (t) => [flat('luminosity', 4 * t), flat('coherence', 4 * t)] },
    ],
    { desc: 'Nothing bound stays bound', modifiers: [pct('harvestYield', 20), pct('lanceRange', 15)], tags: ['master-attuner'] }),
  profession('lancer', 'Lancer', 'ash', 'Turns the lance on what hunts you. Paid in Ash, what a wisp leaves behind.', 0xff5f8a,
    { desc: 'The basics of the fight', modifiers: [pct('lanceDps', 4)], tags: [] },
    [
      { key: 'lance', name: 'Lance', desc: 'A hotter lance', tiers: ['Sharp lance', 'Hot lance', 'Searing lance', 'Sun lance'], mod: (t) => [pct('lanceDps', 6 * t)] },
      { key: 'ward', name: 'Ward', desc: 'A thicker shield', tiers: ['First ward', 'Firm ward', 'Deep ward', 'Iron ward'], mod: (t) => [pct('shield', 7 * t)] },
      { key: 'mend', name: 'Mend', desc: 'The shield knits faster', tiers: ['Quick mend', 'Steady mend', 'Deep mend', 'Living mend'], mod: (t) => [pct('shieldRegen', 10 * t)] },
      { key: 'frame', name: 'Frame', desc: 'More hull to lose', tiers: ['Braced frame', 'Dense frame', 'Hard frame', 'Adamant frame'], mod: (t) => [flat('integrity', 8 * t)] },
    ],
    { desc: 'The wisps learn to fear the light', modifiers: [pct('lanceDps', 15), pct('lockTime', -15)], tags: ['master-lancer'] }),
  profession('wayfarer', 'Wayfarer', 'cerule', 'Knows the lanes between the stars. Paid in Cerule.', 0x60a5fa,
    { desc: 'The basics of flight', modifiers: [pct('maxSpeed', 3)], tags: [] },
    [
      { key: 'drive', name: 'Drive', desc: 'A faster vessel', tiers: ['Quick drive', 'Fast drive', 'Swift drive', 'Light drive'], mod: (t) => [pct('maxSpeed', 5 * t)] },
      { key: 'chart', name: 'Chart', desc: 'The attunement reaches further', tiers: ['Near chart', 'Far chart', 'Deep chart', 'Star chart'], mod: (t) => [pct('overviewRange', 15 * t)] },
      { key: 'core', name: 'Core', desc: 'A brighter core feeds the fit', tiers: ['Warm core', 'Bright core', 'Blazing core', 'Star core'], mod: (t) => [pct('luminosity', 4 * t)] },
      { key: 'poise', name: 'Poise', desc: 'Lighter, tougher hull', tiers: ['Steady poise', 'Sure poise', 'Calm poise', 'Perfect poise'], mod: (t) => [flat('integrity', 5 * t), pct('shieldRegen', 4 * t)] },
    ],
    { desc: 'No distance is far', modifiers: [pct('maxSpeed', 12), pct('overviewRange', 25)], tags: ['master-wayfarer'] }),
];
export const BOX_BY_ID = Object.fromEntries(PROFESSIONS.flatMap((p) => p.boxes).map((b) => [b.id, b]));
export const PROF_BY_ID = Object.fromEntries(PROFESSIONS.map((p) => [p.id, p]));

/** a fresh skill state */
export function newSkills() { return { learned: [] }; }
export function normalizeSkills(s) {
  const out = newSkills();
  if (s && Array.isArray(s.learned)) out.learned = s.learned.filter((id) => BOX_BY_ID[id]);
  return out;
}
export const has = (s, id) => s.learned.includes(id);
export function pointsUsed(s) { return s.learned.reduce((n, id) => n + BOX_BY_ID[id].cost, 0); }

/** hold: fragments by energy key. { ok } or { ok: false, code, reason } */
export function canLearn(s, box, hold = {}) {
  if (has(s, box.id)) return { ok: false, code: 'known', reason: 'Already learned' };
  const missing = box.requires.filter((r) => !has(s, r));
  if (missing.length) return { ok: false, code: 'prereq', reason: `Needs ${missing.map((r) => BOX_BY_ID[r].name).join(', ')}` };
  if (pointsUsed(s) + box.cost > SKILL_CAP) return { ok: false, code: 'points', reason: `Needs ${box.cost} skill points, ${SKILL_CAP - pointsUsed(s)} free` };
  const short = Object.entries(box.frags).filter(([k, n]) => (hold[k] || 0) < n);
  if (short.length) return { ok: false, code: 'frags', reason: `Needs ${short.map(([k, n]) => `${n} ${k} (${Math.floor(hold[k] || 0)} held)`).join(', ')}` };
  return { ok: true };
}
/** learn and pay: fragments are taken from hold (mutated) */
export function learn(s, box, hold = {}) {
  const r = canLearn(s, box, hold);
  if (r.ok) { s.learned.push(box.id); for (const k in box.frags) hold[k] -= box.frags[k]; }
  return r;
}
/** boxes that list this box as a requirement and are learned */
export function dependents(s, box) { return s.learned.map((id) => BOX_BY_ID[id]).filter((b) => b.requires.includes(box.id)); }
export function canSurrender(s, box) {
  if (!has(s, box.id)) return { ok: false, code: 'unknown', reason: 'Not learned' };
  const d = dependents(s, box);
  if (d.length) return { ok: false, code: 'dependents', reason: `Surrender ${d.map((b) => b.name).join(', ')} first` };
  return { ok: true };
}
/** refunds skill points (by removal), never fragments */
export function surrender(s, box) {
  const r = canSurrender(s, box);
  if (r.ok) s.learned = s.learned.filter((id) => id !== box.id);
  return r;
}
/** all stat modifiers from learned boxes */
export function skillModifiers(s) { return s.learned.flatMap((id) => BOX_BY_ID[id].modifiers); }
export function skillTags(s) { return new Set(s.learned.flatMap((id) => BOX_BY_ID[id].tags)); }
/** the box the player could learn next in a branch, or null when the branch is done */
export function nextInBranch(s, prof, branchKey) { return prof.boxes.find((b) => b.branch === branchKey && !has(s, b.id)) || null; }
