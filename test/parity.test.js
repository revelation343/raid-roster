// Parity against r3con's Google Sheet, using Tim's live roster (24 locked, 1 benched).
//
// Expected values are transcribed FROM THE LIVE SHEET and are the specification.
// If one of these fails, the reference table in game-data.js is wrong.
// Do not edit the fixture or these numbers to make the suite green.
//
// Three values deliberately differ from the sheet — the bugs fixed in docs/spec.md §7.
// Each is asserted explicitly below so a fix can never be confused with drift.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeAll } from '../js/compute.js';

const roster = JSON.parse(
  readFileSync(new URL('./fixtures/live-roster.json', import.meta.url), 'utf8'));
const d = computeAll(roster);
const at = (rows, label) => {
  const row = rows.find(r => r.label === label);
  assert.ok(row, `no row labelled ${label}`);
  return row;
};

test('roster shape', () => {
  assert.equal(roster.players.length, 25);
  assert.equal(d.totals.lockedIn, 24);
  assert.equal(d.totals.bench, 1);
});

// ---------------------------------------------------------------- raid roles

test('role main counts', () => {
  assert.equal(at(d.roles, 'Tank').main, 2);
  assert.equal(at(d.roles, 'Melee DPS').main, 8);
  assert.equal(at(d.roles, 'Ranged DPS').main, 9); // sheet says 8 — see FIX 1
  assert.equal(at(d.roles, 'Healer').main, 4);
  assert.equal(at(d.roles, 'Augvoker').main, 0);
});

test('FIX 1: Devourer counts as Ranged DPS (sheet dropped it entirely)', () => {
  assert.equal(at(d.roles, 'Ranged DPS').main, 9,
    'Mortal (Demon Hunter/Devourer) must be counted');
});

// The assertion the sheet never had. Its absence is why 22-vs-24 went unnoticed.
test('roles reconcile against locked-in count', () => {
  const sum = d.roles.reduce((a, r) => a + r.main, 0);
  assert.equal(sum + d.incomplete.length, d.totals.lockedIn,
    `roles(${sum}) + incomplete(${d.incomplete.length}) != locked(${d.totals.lockedIn})`);
});

test('Emilios is the only incomplete player', () => {
  assert.deepEqual(d.incomplete.map(p => p.name), ['Emilios']);
});

// ------------------------------------------------------------------- classes

test('class main counts match the sheet', () => {
  const expected = {
    'Death Knight': 2, 'Demon Hunter': 1, 'Evoker': 0, 'Druid': 2, 'Hunter': 2,
    'Mage': 5, 'Monk': 2, 'Paladin': 3, 'Priest': 1, 'Rogue': 0, 'Shaman': 3,
    'Warlock': 1, 'Warrior': 2,
  };
  for (const [cls, n] of Object.entries(expected)) {
    assert.equal(at(d.classes, cls).main, n, `${cls} main`);
  }
});

test('class main counts sum to the locked-in count', () => {
  assert.equal(d.classes.reduce((a, c) => a + c.main, 0), 24);
});

test('class alt counts match the sheet', () => {
  const expected = {
    'Death Knight': 1, 'Demon Hunter': 5, 'Evoker': 0, 'Druid': 2, 'Hunter': 0,
    'Mage': 0, 'Monk': 1, 'Paladin': 0, 'Priest': 1, 'Rogue': 1, 'Shaman': 0,
    'Warlock': 2, 'Warrior': 3,
  };
  for (const [cls, n] of Object.entries(expected)) {
    assert.equal(at(d.classes, cls).alt, n, `${cls} alt`);
  }
});

// ------------------------------------------------------- buffs and debuffs

test('all 25 buff main counts match the sheet', () => {
  const expected = {
    'Intellect': 5, 'Attack Power': 2, 'Stamina': 1, '3% DR (Devo Aura)': 3,
    '5% Physical': 2, '3% Magic': 1, '3% Versatility': 2, '3% Damage': 2,
    'Bloodlust': 8, 'Combat Res': 8, 'Burst Move Speed': 5,
    'Lock Stuff (HS, Gate, Curse)': 1, 'Mass Dispel': 2, 'Innervate': 2,
    'Death Grip/AMZ': 2, 'Blessing of Protection': 3, 'Rallying Cry': 2,
    'Darkness': 1, 'Immunities': 10, 'Skyfury': 3, 'Boss DR': 0, 'Dragons': 0,
    'Execute Damage': 8, 'Attack Speed Reduction': 3, 'Cast Speed Reduction': 1,
  };
  assert.equal(Object.keys(expected).length, 25);
  for (const [label, n] of Object.entries(expected)) {
    assert.equal(at(d.buffs, label).main, n, `${label} main`);
  }
});

test('FIX 2: 3% Damage reads Hunter, not Druid, on both columns', () => {
  // Hunter mains = 2, Hunter alts = 0. The sheet's Q9 reported Druid alts (2).
  assert.equal(at(d.buffs, '3% Damage').main, 2);
  assert.equal(at(d.buffs, '3% Damage').alt, 0);
});

// ------------------------------------------------------------------ utility

test('all 8 utility main counts match the sheet', () => {
  const expected = {
    'Knock Up/Back': 14, 'Mortal Strike': 1, 'Soothe': 6, 'Purge': 11,
    'Power Infusion': 1, 'Extra Dam to Shields': 2, 'Cheat Death': 2,
    'Blessing of Spellwarding': 0,
  };
  assert.equal(Object.keys(expected).length, 8);
  for (const [label, n] of Object.entries(expected)) {
    assert.equal(at(d.utility, label).main, n, `${label} main`);
  }
});

// -------------------------------------------------------------- tier tokens

test('tier token main counts match the sheet', () => {
  assert.equal(at(d.tierTokens, 'Dreadful (Cloth)').main, 7);
  assert.equal(at(d.tierTokens, 'Mystic (Leather)').main, 5);
  assert.equal(at(d.tierTokens, 'Venerated (Mail)').main, 5);
  assert.equal(at(d.tierTokens, 'Zenith (Plate)').main, 7);
});

test('tier tokens partition the locked roster exactly', () => {
  assert.equal(d.tierTokens.reduce((a, t) => a + t.main, 0), 24);
});

// --------------------------------------------------------- cooldown profiles

test('FIX 3: Marksmanship registers in the 2 min profile', () => {
  // Sheet reads 2; it searched for "Marksman" against the string "Marksmanship".
  assert.equal(at(d.cooldowns, '2 min').main, 3, 'Radoodoo must be counted');
});

test('other cooldown profiles match the sheet', () => {
  assert.equal(at(d.cooldowns, '1 and 1.5 min').main, 5);
  assert.equal(at(d.cooldowns, '3 min').main, 1);
});

// ------------------------------------------------- offspec/alt regression
//
// Alt columns are pinned to computed behaviour, not to the sheet's displayed
// values. Two reasons:
//
//   1. The sheet's alt formulas are inconsistent row to row about whether the
//      main OFF-SPEC counts. Q25 (Execute Damage) omits it; U16 (Cheat Death)
//      and U21/U22 include it. We include it everywhere, consistently.
//   2. Tim's copy dates from 2026-01-01; the template was revised on
//      2026-02-04 (it gained the "3% Damage" row). The alt figures shown in
//      his copy were not produced by the formulas extracted here.
//
// Class and tier-token alt counts DO match the sheet exactly and are asserted
// against it above. These are a regression guard.

test('alt counts are stable', () => {
  assert.equal(at(d.roles, 'Tank').alt, 8);
  assert.equal(at(d.roles, 'Healer').alt, 3);
  assert.equal(at(d.buffs, 'Execute Damage').alt, 8);
  assert.equal(at(d.utility, 'Cheat Death').alt, 7);
});

test('Combat Res alt no longer double-counts the main roster', () => {
  // The sheet's Q12 added the main-class counts into the alt column and skipped
  // the bench filter, reporting 14. Only Warlock/Druid/DK/Paladin ALTS count.
  assert.equal(at(d.buffs, 'Combat Res').alt, 5);
});

test('specs with no cooldown profile are surfaced, not dropped', () => {
  // Arcane, Frost, Elemental and Devourer have no profile in the source template.
  assert.ok(d.cooldownUnassigned.main > 0);
  const assigned = d.cooldowns.reduce((a, c) => a + c.main, 0);
  const withSpec = 24 - d.incomplete.length;
  assert.equal(assigned + d.cooldownUnassigned.main, withSpec,
    'every locked player with a spec lands in a profile or in Unassigned');
});
