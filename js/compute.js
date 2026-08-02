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
//
// Every tally collects the CONTRIBUTORS that produced it, and the count is that
// list's length. A displayed number and the names behind it therefore cannot
// disagree — see the invariant test in test/contributors.test.js.

import {
  CLASSES, ROLE_ORDER, roleFor,
  BUFFS, UTILITY, TIER_TOKENS, COOLDOWNS,
} from './game-data.js';

const isLocked = p => p.status === 'locked';

/** One contribution: who, on what character, reached by which slot. */
const via = (p, cls, spec, slot) => ({
  id: p.id, name: p.name || 'unnamed', cls: cls || null, spec: spec || null, slot,
});

/** Turn a contributor list into a displayable row. */
const row = (label, mainWho, altWho, extra = {}) => ({
  label,
  main: mainWho.length,
  alt: altWho.length,
  mainWho,
  altWho,
  ...extra,
});

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

/** The three slots an alt/off-spec tally may match a spec through, in sheet order. */
const altSpecSlots = p => [
  [p.main?.offSpec, p.main?.class, 'off-spec'],
  [p.alt?.spec,     p.alt?.class,  'alt'],
  [p.alt?.offSpec,  p.alt?.class,  'alt off-spec'],
];

function countRoles(players) {
  const rows = ROLE_ORDER.map(label => ({ label, mainWho: [], altWho: [] }));
  const idx = Object.fromEntries(rows.map(r => [r.label, r]));

  for (const p of players) {
    if (isLocked(p) && p.main?.class && p.main?.spec) {
      const r = roleFor(p.main.class, p.main.spec);
      if (r) idx[r].mainWho.push(via(p, p.main.class, p.main.spec, 'main'));
    }
    for (const [spec, cls, slot] of altSpecSlots(p)) {
      if (!spec || !cls) continue;
      const r = roleFor(cls, spec);
      if (r) idx[r].altWho.push(via(p, cls, spec, slot));
    }
  }
  return rows.map(r => row(r.label, r.mainWho, r.altWho));
}

function countClasses(players) {
  return Object.keys(CLASSES).map(label => row(
    label,
    players.filter(p => isLocked(p) && p.main?.class === label)
      .map(p => via(p, label, p.main.spec, 'main')),
    players.filter(p => p.alt?.class === label)
      .map(p => via(p, label, p.alt.spec, 'alt')),
  ));
}

function mainContributors(entry, players) {
  const who = [];
  for (const p of players) {
    if (!isLocked(p)) continue;
    const cls = p.main?.class, spec = p.main?.spec;
    if (cls && (entry.classes || []).includes(cls)) who.push(via(p, cls, spec, 'main'));
    if (spec && (entry.specs || []).includes(spec)) who.push(via(p, cls, spec, 'main'));
    if (cls && spec && (entry.pairs || []).some(([c, s]) => c === cls && s === spec)) {
      who.push(via(p, cls, spec, 'main'));
    }
  }
  return who;
}

function altContributors(entry, players) {
  const who = [];
  for (const p of players) {
    if (p.alt?.class && (entry.classes || []).includes(p.alt.class)) {
      who.push(via(p, p.alt.class, p.alt.spec, 'alt'));
    }
    for (const [spec, cls, slot] of altSpecSlots(p)) {
      if (spec && (entry.specs || []).includes(spec)) who.push(via(p, cls, spec, slot));
    }
    for (const [c, s] of entry.pairs || []) {
      if (p.main?.class === c && p.main?.offSpec === s) who.push(via(p, c, s, 'off-spec'));
      if (p.alt?.class === c && p.alt?.spec === s) who.push(via(p, c, s, 'alt'));
      if (p.alt?.class === c && p.alt?.offSpec === s) who.push(via(p, c, s, 'alt off-spec'));
    }
  }
  return who;
}

const countTable = (entries, players) => entries.map(e =>
  row(e.label, mainContributors(e, players), altContributors(e, players)));

/**
 * Specs that land in no cooldown profile at all. The source template only ever
 * covered DPS specs, so tanks, healers and several DPS specs fall through. Left
 * as-is deliberately — surfaced rather than invented.
 */
function unassignedCooldowns(entries, players) {
  const covered = new Set(entries.flatMap(e => e.specs || []));
  const mainWho = [], altWho = [];
  for (const p of players) {
    if (isLocked(p) && p.main?.class && p.main?.spec && !covered.has(p.main.spec)) {
      mainWho.push(via(p, p.main.class, p.main.spec, 'main'));
    }
    for (const [spec, cls, slot] of altSpecSlots(p)) {
      if (spec && !covered.has(spec)) altWho.push(via(p, cls, spec, slot));
    }
  }
  return row('Unassigned', mainWho, altWho);
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
    cooldownUnassigned: unassignedCooldowns(COOLDOWNS, players),
    incomplete: locked.filter(p => !p.main?.class || !p.main?.spec),
    totals: {
      lockedIn: locked.length,
      bench: players.filter(p => p.status === 'bench').length,
      out: players.filter(p => p.status === 'out').length,
    },
  };
}
