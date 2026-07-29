import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLASSES, CLASS_COLORS, ROLES, roleFor,
  BUFFS, UTILITY, TIER_TOKENS, COOLDOWNS, allSpecNames,
} from '../js/game-data.js';

test('has all 13 playable classes', () => {
  assert.equal(Object.keys(CLASSES).length, 13);
});

test('Demon Hunter has the three Midnight specs including Devourer', () => {
  assert.deepEqual(CLASSES['Demon Hunter'], ['Havoc', 'Vengeance', 'Devourer']);
});

test('spec names are unique within a class', () => {
  for (const [cls, specs] of Object.entries(CLASSES)) {
    assert.equal(new Set(specs).size, specs.length, `${cls} has duplicate specs`);
  }
});

test('every class has a colour', () => {
  for (const cls of Object.keys(CLASSES)) {
    assert.match(CLASS_COLORS[cls] || '', /^#[0-9A-F]{6}$/i, `${cls} colour`);
  }
});

// The check that would have caught Devourer being classified nowhere.
test('every class/spec pair resolves to exactly one role', () => {
  const unclassified = [];
  for (const [cls, specs] of Object.entries(CLASSES)) {
    for (const spec of specs) {
      const matches = Object.entries(ROLES)
        .filter(([, table]) => (table[cls] || []).includes(spec))
        .map(([role]) => role);
      if (matches.length !== 1) unclassified.push(`${cls}/${spec} -> [${matches}]`);
    }
  }
  assert.deepEqual(unclassified, [], 'specs not in exactly one role');
});

test('Devourer is Ranged DPS, not Tank or Melee', () => {
  assert.equal(roleFor('Demon Hunter', 'Devourer'), 'Ranged DPS');
});

test('Frost resolves by class', () => {
  assert.equal(roleFor('Mage', 'Frost'), 'Ranged DPS');
  assert.equal(roleFor('Death Knight', 'Frost'), 'Melee DPS');
});

test('Holy resolves by class', () => {
  assert.equal(roleFor('Paladin', 'Holy'), 'Healer');
  assert.equal(roleFor('Priest', 'Holy'), 'Healer');
});

test('roleFor returns null for unknown or partial pairs', () => {
  assert.equal(roleFor('Mage', 'Blood'), null);
  assert.equal(roleFor('Mage', null), null);
  assert.equal(roleFor(null, 'Frost'), null);
});

// Closure test: makes a Marksman/Marksmanship typo impossible.
test('every spec named in any table exists in CLASSES', () => {
  const valid = new Set(Object.values(CLASSES).flat());
  const bad = [...allSpecNames()].filter(s => !valid.has(s));
  assert.deepEqual(bad, [], 'unknown spec names');
});

test('every class named in any table exists in CLASSES', () => {
  const bad = [];
  for (const e of [...BUFFS, ...UTILITY, ...TIER_TOKENS, ...COOLDOWNS]) {
    for (const c of e.classes || []) if (!CLASSES[c]) bad.push(`${e.label}: ${c}`);
    for (const [c] of e.pairs || []) if (!CLASSES[c]) bad.push(`${e.label}: ${c}`);
  }
  assert.deepEqual(bad, []);
});

test('3% Damage is provided by Hunter', () => {
  assert.deepEqual(BUFFS.find(b => b.label === '3% Damage').classes, ['Hunter']);
});

test('Marksmanship is in the 2 min cooldown profile', () => {
  assert.ok(COOLDOWNS.find(c => c.label === '2 min').specs.includes('Marksmanship'));
});

test('Bloodlust excludes Hunter pets', () => {
  assert.deepEqual(BUFFS.find(b => b.label === 'Bloodlust').classes,
    ['Mage', 'Shaman', 'Evoker']);
});

test('every class has exactly one tier token', () => {
  for (const cls of Object.keys(CLASSES)) {
    const n = TIER_TOKENS.filter(t => t.classes.includes(cls)).length;
    assert.equal(n, 1, `${cls} has ${n} tier tokens`);
  }
});
