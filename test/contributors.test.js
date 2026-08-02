// The coverage panel lets you expand any tally to see the names behind it.
// A number that disagrees with its own list is worse than no list at all, so
// every count is asserted to equal the length of the contributor list it came
// from — across every block, for both the main and the alt column.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeAll } from '../js/compute.js';

const load = f => JSON.parse(readFileSync(new URL(f, import.meta.url), 'utf8'));
const fixture = load('./fixtures/live-roster.json');

const BLOCKS = ['roles', 'classes', 'buffs', 'utility', 'tierTokens', 'cooldowns'];

function everyRow(d) {
  return BLOCKS.flatMap(b => d[b].map(r => [b, r])).concat([['cooldownUnassigned', d.cooldownUnassigned]]);
}

test('every count equals the length of its contributor list', () => {
  const d = computeAll(fixture);
  const bad = [];
  for (const [block, r] of everyRow(d)) {
    if (r.main !== r.mainWho.length) bad.push(`${block}/${r.label} main ${r.main} vs ${r.mainWho.length}`);
    if (r.alt !== r.altWho.length) bad.push(`${block}/${r.label} alt ${r.alt} vs ${r.altWho.length}`);
  }
  assert.deepEqual(bad, []);
});

test('contributors carry a name, class and slot', () => {
  const d = computeAll(fixture);
  const slots = new Set(['main', 'off-spec', 'alt', 'alt off-spec']);
  for (const [block, r] of everyRow(d)) {
    for (const c of [...r.mainWho, ...r.altWho]) {
      assert.ok(c.name, `${block}/${r.label}: contributor with no name`);
      assert.ok(c.id, `${block}/${r.label}: contributor with no id`);
      assert.ok(slots.has(c.slot), `${block}/${r.label}: bad slot ${c.slot}`);
    }
  }
});

test('main contributors are only ever locked-in players', () => {
  const d = computeAll(fixture);
  const benched = new Set(fixture.players.filter(p => p.status !== 'locked').map(p => p.id));
  for (const [block, r] of everyRow(d)) {
    for (const c of r.mainWho) {
      assert.ok(!benched.has(c.id), `${block}/${r.label}: benched ${c.name} in a main tally`);
    }
  }
});

test('named contributors match the roster — Tank is who you think it is', () => {
  const d = computeAll(fixture);
  const tanks = d.roles.find(r => r.label === 'Tank');
  assert.deepEqual(tanks.mainWho.map(c => c.name).sort(), ['Gill Grunt', 'Gwarrar']);
  assert.deepEqual(tanks.mainWho.map(c => c.spec).sort(), ['Blood', 'Brewmaster']);
});

test('Intellect expands to exactly the Mages', () => {
  const d = computeAll(fixture);
  const intellect = d.buffs.find(b => b.label === 'Intellect');
  assert.deepEqual(intellect.mainWho.map(c => c.name).sort(),
    ['BigWill', 'Frosht', 'Nitrogenburn', 'Pwandacookie', 'Valadrim']);
  assert.ok(intellect.mainWho.every(c => c.cls === 'Mage'));
});

test('a player contributing twice to one tally appears twice', () => {
  // Caseus alts Warrior Fury with an Arms off-spec; both are Zenith (Plate).
  const d = computeAll(fixture);
  const zenith = d.tierTokens.find(t => t.label === 'Zenith (Plate)');
  const caseus = zenith.altWho.filter(c => c.name.startsWith('Caseus'));
  assert.equal(caseus.length, 1, 'tier token is a class criterion — once per player');
  assert.equal(caseus[0].slot, 'alt');
});

test('alt contributors record which slot they came through', () => {
  const d = computeAll(fixture);
  const slots = new Set(d.roles.flatMap(r => r.altWho.map(c => c.slot)));
  assert.ok(slots.has('off-spec'), 'main off-specs should appear');
  assert.ok(slots.has('alt'), 'alt main specs should appear');
  assert.ok(slots.has('alt off-spec'), 'alt off-specs should appear');
});

test('holds on the live roster too, whatever is currently signed up', () => {
  const live = load('../data/roster.json');
  const d = computeAll(live);
  const bad = [];
  for (const [block, r] of everyRow(d)) {
    if (r.main !== r.mainWho.length) bad.push(`${block}/${r.label} main`);
    if (r.alt !== r.altWho.length) bad.push(`${block}/${r.label} alt`);
  }
  assert.deepEqual(bad, []);
  assert.equal(
    d.roles.reduce((a, r) => a + r.main, 0) + d.incomplete.length,
    d.totals.lockedIn,
    'roles + incomplete must still reconcile against the live roster');
});
