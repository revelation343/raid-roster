// Shared with the client, so a payload the UI could never produce is also a
// payload the Worker will never commit. Returns null when valid, else a reason.

import { CLASSES } from '../js/game-data.js';

const STATUSES = new Set(['locked', 'bench', 'out']);
const MAX_PLAYERS = 500;

function checkSide(side, where) {
  if (side == null) return null;
  if (typeof side !== 'object') return `${where}: must be an object`;
  const cls = side.class;
  if (cls != null && !CLASSES[cls]) return `${where}: unknown class ${cls}`;
  for (const field of ['spec', 'offSpec']) {
    const spec = side[field];
    if (spec == null) continue;
    if (!cls) return `${where}.${field}: spec ${spec} with no class`;
    if (!CLASSES[cls].includes(spec)) return `${where}.${field}: ${spec} is not a ${cls} spec`;
  }
  return null;
}

export function validateRoster(roster) {
  if (!roster || typeof roster !== 'object' || Array.isArray(roster)) {
    return 'roster must be an object';
  }
  if (!Array.isArray(roster.players)) return 'players must be an array';
  if (roster.players.length > MAX_PLAYERS) return 'too many players';
  if (roster.title != null && (typeof roster.title !== 'string' || roster.title.length > 120)) {
    return 'bad title';
  }

  const seen = new Set();
  for (const [i, p] of roster.players.entries()) {
    const at = `player ${i}`;
    if (!p || typeof p !== 'object') return `${at}: must be an object`;
    if (typeof p.id !== 'string' || !p.id || p.id.length > 64) return `${at}: bad id`;
    if (seen.has(p.id)) return `${at}: duplicate id ${p.id}`;
    seen.add(p.id);
    if (typeof p.name !== 'string' || p.name.length > 64) return `${at}: bad name`;
    if (p.note != null && (typeof p.note !== 'string' || p.note.length > 500)) {
      return `${at}: bad note`;
    }
    if (!STATUSES.has(p.status)) return `${at}: bad status ${p.status}`;

    for (const [key, side] of [['main', p.main], ['alt', p.alt]]) {
      const err = checkSide(side, `${at} ${key}`);
      if (err) return err;
    }
  }
  return null;
}
