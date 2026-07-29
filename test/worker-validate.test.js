import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateRoster } from '../worker/validate.js';

const good = JSON.parse(
  readFileSync(new URL('./fixtures/live-roster.json', import.meta.url), 'utf8'));
const mutate = fn => { const c = structuredClone(good); fn(c); return c; };

test('accepts the live roster', () => {
  assert.equal(validateRoster(good), null);
});

test('rejects an unknown class', () => {
  const bad = mutate(r => { r.players[0].main.class = 'Tinker'; });
  assert.match(validateRoster(bad), /unknown class/i);
});

test('rejects a spec that does not belong to its class', () => {
  const bad = mutate(r => { r.players[0].main.spec = 'Frost'; }); // Paladin
  assert.match(validateRoster(bad), /not a Paladin spec/i);
});

test('rejects a spec with no class', () => {
  const bad = mutate(r => { r.players[0].main = { class: null, spec: 'Frost', offSpec: null }; });
  assert.match(validateRoster(bad), /no class/i);
});

test('rejects a bad status', () => {
  const bad = mutate(r => { r.players[0].status = 'benched'; });
  assert.match(validateRoster(bad), /bad status/i);
});

test('rejects duplicate ids', () => {
  const bad = mutate(r => { r.players[1].id = r.players[0].id; });
  assert.match(validateRoster(bad), /duplicate id/i);
});

test('rejects a non-array players field', () => {
  assert.match(validateRoster({ players: 'nope' }), /players must be an array/i);
});

test('rejects an oversized roster', () => {
  const one = good.players[0];
  const bad = { players: Array.from({ length: 501 }, (_, i) => ({ ...structuredClone(one), id: `x${i}` })) };
  assert.match(validateRoster(bad), /too many/i);
});

test('rejects an overlong note', () => {
  const bad = mutate(r => { r.players[0].note = 'x'.repeat(501); });
  assert.match(validateRoster(bad), /bad note/i);
});

test('rejects non-objects', () => {
  assert.match(validateRoster(null), /must be an object/i);
  assert.match(validateRoster([]), /must be an object/i);
});

test('accepts a player mid-signup with a class but no spec', () => {
  const ok = mutate(r => { r.players[0].main = { class: 'Mage', spec: null, offSpec: null }; });
  assert.equal(validateRoster(ok), null);
});
