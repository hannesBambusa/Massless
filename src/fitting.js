// Fitting engine: pure domain logic, no DOM, no three. A Shell (the vessel) has slot capacities and two resources,
// Luminosity (powergrid) and Coherence (CPU). Modules fill slots, cost resources and modify stats. Modules that share a
// SpectrumFamily unlock Harmonic set bonuses at count thresholds. Every function here is deterministic and returns new
// data or a result object, so it can be unit tested without the game running.
//
// Stat model: flat modifiers sum, then percentage modifiers multiply (no stacking penalty). Order: base -> modules -> sets.
// A module that would push resources over the cap when a Core module is removed is set `online: false`, never deleted,
// so the player keeps the gear.

export const SLOTS = ['corona', 'orbit', 'core'];   // high, mid, low
export const OFFLINE_ORDER = ['corona', 'orbit', 'core'];   // who goes dark first when resources shrink

/** a fresh shell state from a shell definition: { id, integrity, shield, shieldRegen, luminosity, coherence, slots: {corona, orbit, core}, base: {...other base stats} } */
export function newShell(def) {
  const equipped = {}; for (const s of SLOTS) equipped[s] = Array.from({ length: def.slots[s] || 0 }, () => null);
  return { id: def.id, def, equipped };
}

/** every fitted module with its slot and index: [{ slot, index, module, online }] */
export function fitted(shell) {
  const out = [];
  for (const s of SLOTS) shell.equipped[s].forEach((m, i) => { if (m) out.push({ slot: s, index: i, module: m.module, online: m.online }); });
  return out;
}

/** base stats of the shell as a flat stat object */
export function baseStats(shell) { return { ...shell.def.base, luminosity: shell.def.luminosity, coherence: shell.def.coherence }; }

/** apply a list of modifiers to a stat object: flats first, then percents (multiplicative) */
export function applyModifiers(stats, mods) {
  const out = { ...stats };
  for (const m of mods) if (!m.isPercentage) out[m.stat] = (out[m.stat] || 0) + m.value;
  for (const m of mods) if (m.isPercentage) out[m.stat] = (out[m.stat] || 0) * (1 + m.value / 100);
  return out;
}

/** resource capacity after online Core modules (they can raise luminosity / coherence); only Core modules count here so a fit can't bootstrap itself */
export function capacity(shell, extra = null) {
  const mods = [];
  for (const f of fitted(shell)) if (f.online && f.slot === 'core') mods.push(...f.module.modifiers.filter((m) => m.stat === 'luminosity' || m.stat === 'coherence'));
  if (extra && extra.slot === 'core') mods.push(...extra.modifiers.filter((m) => m.stat === 'luminosity' || m.stat === 'coherence'));
  const s = applyModifiers({ luminosity: shell.def.luminosity, coherence: shell.def.coherence }, mods);
  return { luminosity: s.luminosity, coherence: s.coherence };
}

/** resources used by online modules */
export function usage(shell) {
  let luminosity = 0, coherence = 0;
  for (const f of fitted(shell)) if (f.online) { luminosity += f.module.luminosityCost; coherence += f.module.coherenceCost; }
  return { luminosity, coherence };
}

/** can this module go in this slot type? returns { ok: true, index } or { ok: false, reason, code } */
export function canEquip(shell, module, slot) {
  if (module.slot !== slot) return { ok: false, code: 'slot', reason: `${module.name} needs a ${module.slot} slot` };
  const index = shell.equipped[slot].indexOf(null);
  if (index < 0) return { ok: false, code: 'full', reason: `No free ${slot} slot` };
  const cap = capacity(shell, module), use = usage(shell);
  if (use.luminosity + module.luminosityCost > cap.luminosity + 1e-9) return { ok: false, code: 'luminosity', reason: `Not enough luminosity: needs ${module.luminosityCost}, ${Math.max(0, cap.luminosity - use.luminosity).toFixed(0)} free` };
  if (use.coherence + module.coherenceCost > cap.coherence + 1e-9) return { ok: false, code: 'coherence', reason: `Not enough coherence: needs ${module.coherenceCost}, ${Math.max(0, cap.coherence - use.coherence).toFixed(0)} free` };
  return { ok: true, index };
}

/** equip in the first free slot of `slot`; mutates shell; returns the canEquip result */
export function equip(shell, module, slot) {
  const r = canEquip(shell, module, slot);
  if (r.ok) shell.equipped[slot][r.index] = { module, online: true };
  return r;
}

/** remove a module; then take modules offline (Corona first, then Orbit, then Core) until the fit is within capacity. returns { module, offlined: [module] } */
export function unequip(shell, slot, index) {
  const cell = shell.equipped[slot][index];
  if (!cell) return { module: null, offlined: [] };
  shell.equipped[slot][index] = null;
  return { module: cell.module, offlined: settle(shell) };
}

/** take modules offline until usage fits capacity; returns the modules that went dark */
export function settle(shell) {
  const offlined = [];
  for (const s of OFFLINE_ORDER) {
    for (let i = shell.equipped[s].length - 1; i >= 0; i--) {
      const cap = capacity(shell), use = usage(shell);
      if (use.luminosity <= cap.luminosity + 1e-9 && use.coherence <= cap.coherence + 1e-9) return offlined;
      const cell = shell.equipped[s][i];
      if (cell && cell.online) { cell.online = false; offlined.push(cell.module); }
    }
  }
  return offlined;
}

/** try to bring offline modules back (Core first so capacity returns before consumers); returns the modules that came back */
export function relight(shell) {
  const back = [];
  for (const s of [...OFFLINE_ORDER].reverse()) for (const cell of shell.equipped[s]) {
    if (!cell || cell.online) continue;
    cell.online = true;
    const cap = capacity(shell), use = usage(shell);
    if (use.luminosity > cap.luminosity + 1e-9 || use.coherence > cap.coherence + 1e-9) cell.online = false; else back.push(cell.module);
  }
  return back;
}

/** active harmonic set bonuses: [{ set, count }] for every set whose family count meets its threshold */
export function evaluateSets(shell, sets) {
  const counts = {};
  for (const f of fitted(shell)) if (f.online) counts[f.module.family] = (counts[f.module.family] || 0) + 1;
  return sets.filter((s) => (counts[s.family] || 0) >= s.count).map((set) => ({ set, count: counts[set.family] }));
}

/** final stats: base -> online module modifiers -> active set modifiers. also returns resource state and active sets */
export function calcStats(shell, sets) {
  const mods = [];
  for (const f of fitted(shell)) if (f.online) mods.push(...f.module.modifiers);
  const active = evaluateSets(shell, sets);
  for (const a of active) mods.push(...a.set.modifiers);
  const stats = applyModifiers(baseStats(shell), mods);
  return { stats, sets: active, capacity: capacity(shell), usage: usage(shell) };
}

/** serialise: only ids and online flags */
export function serialize(shell) {
  const out = {}; for (const s of SLOTS) out[s] = shell.equipped[s].map((c) => c ? { id: c.module.id, online: c.online } : null); return out;
}
/** restore from serialize() output; unknown ids are dropped; the fit is settled afterwards */
export function deserialize(shell, data, moduleById) {
  if (!data) return shell;
  for (const s of SLOTS) (data[s] || []).forEach((c, i) => { if (i < shell.equipped[s].length && c && moduleById[c.id]) shell.equipped[s][i] = { module: moduleById[c.id], online: c.online !== false }; });
  settle(shell);
  return shell;
}
