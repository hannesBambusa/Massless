import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSkills, canLearn, learn, surrender, pointsUsed, skillModifiers, PROFESSIONS, BOX_BY_ID, SKILL_CAP } from '../src/skills.js';

const B = (id) => BOX_BY_ID[id];
const rich = () => ({ sol: 1e6, ash: 1e6, cerule: 1e6, lumen: 1e6 });

test('prereqs: novice before tier 1, tier below before tier above, all tier 4s before master', () => {
  const s = newSkills(), h = rich();
  assert.equal(canLearn(s, B('attuner.siphon.1'), h).code, 'prereq');
  assert.ok(learn(s, B('attuner.novice'), h).ok);
  assert.equal(canLearn(s, B('attuner.siphon.2'), h).code, 'prereq');
  assert.ok(learn(s, B('attuner.siphon.1'), h).ok);
  assert.equal(canLearn(s, B('attuner.master'), h).code, 'prereq');
});

test('fragments are paid from the hold and gate learning; the novice is free of fragments', () => {
  const s = newSkills(), h = { ash: 60 };
  assert.ok(learn(s, B('lancer.novice'), h).ok);
  assert.equal(h.ash, 60);
  assert.ok(learn(s, B('lancer.lance.1'), h).ok);
  assert.equal(h.ash, 40);
  assert.equal(canLearn(s, B('lancer.lance.2'), h).code, 'frags');
  assert.equal(canLearn(s, B('lancer.ward.1'), h).ok, true);
});

test('master needs lumen as well; points are capped at 250', () => {
  const s = newSkills(), h = rich(); h.lumen = 0;
  for (const b of PROFESSIONS[1].boxes) learn(s, b, h);
  assert.equal(canLearn(s, B('lancer.master'), h).code, 'frags');
  h.lumen = 200; assert.ok(learn(s, B('lancer.master'), h).ok); assert.equal(h.lumen, 80);
  assert.equal(pointsUsed(s), 189);
  assert.ok(learn(s, B('attuner.novice'), h).ok);
  for (let t = 1; t <= 4; t++) assert.ok(learn(s, B(`attuner.siphon.${t}`), h).ok);   // 240
  assert.ok(learn(s, B('attuner.sense.1'), h).ok);                                      // 246
  assert.equal(learn(s, B('attuner.sense.2'), h).code, 'points');                       // 254 > 250
});

test('surrender refunds points, keeps fragments spent, refuses while dependents exist', () => {
  const s = newSkills(), h = { cerule: 100 };
  learn(s, B('wayfarer.novice'), h); learn(s, B('wayfarer.drive.1'), h);
  assert.equal(surrender(s, B('wayfarer.novice')).code, 'dependents');
  assert.ok(surrender(s, B('wayfarer.drive.1')).ok);
  assert.equal(h.cerule, 80); assert.equal(pointsUsed(s), 15);
});

test('modifiers accumulate; ids unique; requirements exist', () => {
  const s = newSkills(), h = rich();
  learn(s, B('attuner.novice'), h); learn(s, B('attuner.siphon.1'), h);
  assert.deepEqual(skillModifiers(s).filter((x) => x.stat === 'harvestYield').map((x) => x.value), [5, 6]);
  const ids = PROFESSIONS.flatMap((p) => p.boxes.map((b) => b.id));
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) for (const r of BOX_BY_ID[id].requires) assert.ok(BOX_BY_ID[r], r);
  assert.ok(SKILL_CAP > 189);
});
