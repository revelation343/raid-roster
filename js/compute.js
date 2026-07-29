// Pure. No DOM. Derives every count from the roster on demand — nothing is stored,
// so there are no formulas to overwrite.
//
// Counting semantics replicate the source sheet exactly:
//
//   MAIN  — locked-in players only (the sheet filtered bench = FALSE).
//           A `classes` criterion matches on main class ALONE and does not
//           require a spec, so a player who has picked a class but not a spec
//           still counts toward their class's buffs and tier token.
//   ALT   — any status (the sheet applied no bench filter to columns D-G).
//           A `classes` criterion matches the alt class once per player;
//           a `specs` criterion matches each of main off-spec, alt spec and
//           alt off-spec independently.
//
// Roles are the exception: they need a definite (class, spec) pair, so a player
// with no main spec is reported as incomplete rather than assigned a role.

import {
  CLASSES, ROLE_ORDER, roleFor,
  BUFFS, UTILITY, TIER_TOKENS, COOLDOWNS,
} from './game-data.js';

const isLocked = p => p.status === 'locked';

export function mainPairs(p) {
  if (!isLocked(p) || !p.main?.class || !p.main?.spec) return [];
  return [[p.main.class, p.main.spec]];
}

export function altPairs(p) {
  const out = [];
  if (p.main?.class && p.main?.offSpec) out.push([p.main.class, p.main.offSpec]);
  if (p.alt?.class) {
    if (p.alt.spec)    out.push([p.alt.class, p.alt.spec]);
    if (p.alt.offSpec) out.push([p.alt.class, p.alt.offSpec]);
  }
  return out;
}

function countRoles(players) {
  const rows = ROLE_ORDER.map(label => ({ label, main: 0, alt: 0 }));
  const idx = Object.fromEntries(rows.map(r => [r.label, r]));
  for (const p of players) {
    for (const [c, s] of mainPairs(p)) { const r = roleFor(c, s); if (r) idx[r].main++; }
    for (const [c, s] of altPairs(p))  { const r = roleFor(c, s); if (r) idx[r].alt++; }
  }
  return rows;
}

function countClasses(players) {
  return Object.keys(CLASSES).map(label => ({
    label,
    main: players.filter(p => isLocked(p) && p.main?.class === label).length,
    alt:  players.filter(p => p.alt?.class === label).length,
  }));
}

function countMain(entry, players) {
  let n = 0;
  for (const p of players) {
    if (!isLocked(p)) continue;
    const cls = p.main?.class, spec = p.main?.spec;
    if (cls && (entry.classes || []).includes(cls)) n++;
    if (spec && (entry.specs || []).includes(spec)) n++;
    if (cls && spec && (entry.pairs || []).some(([c, s]) => c === cls && s === spec)) n++;
  }
  return n;
}

function countAlt(entry, players) {
  let n = 0;
  for (const p of players) {
    if (p.alt?.class && (entry.classes || []).includes(p.alt.class)) n++;
    for (const s of [p.main?.offSpec, p.alt?.spec, p.alt?.offSpec]) {
      if (s && (entry.specs || []).includes(s)) n++;
    }
    for (const [c, s] of entry.pairs || []) {
      if (p.main?.class === c && p.main?.offSpec === s) n++;
      if (p.alt?.class === c && p.alt?.spec === s) n++;
      if (p.alt?.class === c && p.alt?.offSpec === s) n++;
    }
  }
  return n;
}

const countTable = (entries, players) => entries.map(e => ({
  label: e.label,
  main: countMain(e, players),
  alt: countAlt(e, players),
}));

function countUnassigned(entries, players) {
  const covered = new Set(entries.flatMap(e => e.specs || []));
  const tally = pairs => players.reduce(
    (a, p) => a + pairs(p).filter(([, s]) => s && !covered.has(s)).length, 0);
  return { main: tally(mainPairs), alt: tally(altPairs) };
}

export function computeAll(roster) {
  const players = roster.players || [];
  const locked = players.filter(isLocked);
  return {
    roles:      countRoles(players),
    classes:    countClasses(players),
    buffs:      countTable(BUFFS, players),
    utility:    countTable(UTILITY, players),
    tierTokens: countTable(TIER_TOKENS, players),
    cooldowns:  countTable(COOLDOWNS, players),
    cooldownUnassigned: countUnassigned(COOLDOWNS, players),
    incomplete: locked.filter(p => !p.main?.class || !p.main?.spec),
    totals: {
      lockedIn: locked.length,
      bench: players.filter(p => p.status === 'bench').length,
      out: players.filter(p => p.status === 'out').length,
    },
  };
}
