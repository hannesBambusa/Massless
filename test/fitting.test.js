// node --test test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newShell, canEquip, equip, unequip, evaluateSets, calcStats, capacity, usage, serialize, deserialize, relight } from '../src/fitting.js';

const def = { id: 't', luminosity: 100, coherence: 100, slots: { corona: 2, orbit: 1, core: 2 }, base: { integrity: 100, lanceDps: 20 } };
const m = (id, slot, family, lum, coh, modifiers = []) => ({ id, name: id, slot, family, luminosityCost: lum, coherenceCost: coh, modifiers });
const sets = [{ id: 's2', family: 'sol', count: 2, modifiers: [{ stat: 'lanceDps', value: 10, isPercentage: true }] }];

test('slot mismatch and full slots are refused', () => {
  const s = newShell(def);
  assert.equal(canEquip(s, m('a', 'orbit', 'sol', 0, 0), 'corona').code, 'slot');
  assert.ok(equip(s, m('a', 'orbit', 'sol', 0, 0), 'orbit').ok);
  assert.equal(canEquip(s, m('b', 'orbit', 'sol', 0, 0), 'orbit').code, 'full');
});

test('resource caps count core boosts before refusing', () => {
  const s = newShell(def);
  assert.equal(canEquip(s, m('big', 'corona', 'sol', 120, 0), 'corona').code, 'luminosity');
  // a core module that raises luminosity is accepted even though it also costs some
  assert.ok(equip(s, m('lat', 'core', 'lumen', 0, 20, [{ stat: 'luminosity', value: 50, isPercentage: true }]), 'core').ok);
  assert.equal(capacity(s).luminosity, 150);
  assert.ok(equip(s, m('big', 'corona', 'sol', 120, 0), 'corona').ok);
  assert.deepEqual(usage(s), { luminosity: 120, coherence: 20 });
});

test('removing the core boost takes corona offline first, and relight brings it back', () => {
  const s = newShell(def);
  equip(s, m('lat', 'core', 'lumen', 0, 20, [{ stat: 'luminosity', value: 50, isPercentage: true }]), 'core');
  equip(s, m('big', 'corona', 'sol', 120, 0), 'corona');
  equip(s, m('small', 'orbit', 'sol', 10, 0), 'orbit');
  const r = unequip(s, 'core', 0);
  assert.equal(r.module.id, 'lat');
  assert.deepEqual(r.offlined.map((x) => x.id), ['big']);      // corona goes dark, the orbit module stays lit
  assert.equal(s.equipped.corona[0].online, false);
  assert.equal(s.equipped.orbit[0].online, true);
  equip(s, m('lat2', 'core', 'lumen', 0, 20, [{ stat: 'luminosity', value: 50, isPercentage: true }]), 'core');
  assert.deepEqual(relight(s).map((x) => x.id), ['big']);
});

test('set bonuses need online modules and stats stack flats then percents', () => {
  const s = newShell(def);
  equip(s, m('a', 'corona', 'sol', 10, 10, [{ stat: 'lanceDps', value: 10, isPercentage: false }]), 'corona');
  assert.equal(evaluateSets(s, sets).length, 0);
  equip(s, m('b', 'corona', 'sol', 10, 10, [{ stat: 'lanceDps', value: 50, isPercentage: true }]), 'corona');
  const r = calcStats(s, sets);
  assert.equal(r.sets.length, 1);
  assert.equal(r.stats.lanceDps, (20 + 10) * 1.5 * 1.1);
  s.equipped.corona[1].online = false;
  assert.equal(evaluateSets(s, sets).length, 0);
});

test('serialize round trips and drops unknown ids', () => {
  const s = newShell(def), a = m('a', 'corona', 'sol', 10, 10);
  equip(s, a, 'corona'); s.equipped.corona[0].online = false;
  const data = serialize(s); data.orbit[0] = { id: 'ghost', online: true };
  const t = deserialize(newShell(def), data, { a });
  assert.equal(t.equipped.corona[0].module.id, 'a'); assert.equal(t.equipped.corona[0].online, false); assert.equal(t.equipped.orbit[0], null);
});
