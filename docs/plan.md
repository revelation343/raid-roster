# Raid Roster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the r3con raid roster Google Sheet with a static site whose analytics are computed at render time, backed by a JSON file in git so that commit history serves as the audit log.

**Architecture:** Vanilla ES modules, no build step. `game-data.js` holds every class/spec/role/buff mapping as plain tables. `compute.js` is a pure function from roster to derived counts. UI modules render. A Cloudflare Worker holds a GitHub token and commits roster changes; the browser reads commit history back for the audit trail.

**Tech Stack:** ES modules, `node --test` (built-in, Node 25), GitHub Pages, Cloudflare Workers.

Spec: [`docs/spec.md`](./spec.md). Section references below (§6.2 etc.) point into it.

---

## File Structure

| Path | Responsibility |
|---|---|
| `package.json` | `"type": "module"`, test script. No dependencies. |
| `js/game-data.js` | Reference tables only. No logic. Spec §6. |
| `js/compute.js` | Pure: `(roster, gameData) -> derived counts`. No DOM. |
| `js/api.js` | Load roster, save via Worker, fetch commit history. |
| `js/roster-ui.js` | Roster table render + edit handlers. |
| `js/coverage-ui.js` | Six derived blocks render. |
| `js/history-ui.js` | Commit list + restore. |
| `js/app.js` | Tab wiring, state, glue. |
| `index.html`, `css/styles.css` | Shell and styling. |
| `data/roster.json` | The data. |
| `test/fixtures/live-roster.json` | Tim's 2026-07-29 roster, 24 locked + 1 benched. |
| `test/*.test.js` | Tests. |
| `worker/index.js`, `worker/wrangler.toml` | Save endpoint. |

`compute.js` never touches the DOM and `game-data.js` never contains logic — that separation is what makes the parity test possible.

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`, `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "raid-roster",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "test": "node --test test/"
  }
}
```

- [ ] **Step 2: Create `.gitignore`**

```
node_modules/
.wrangler/
.dev.vars
```

- [ ] **Step 3: Verify the test runner works with zero tests**

Run: `npm test`
Expected: exits 0, reports `tests 0`.

- [ ] **Step 4: Commit**

```bash
git add package.json .gitignore
git commit -m "chore: project scaffold"
```

---

## Task 2: Classes and specs table

**Files:**
- Create: `js/game-data.js`
- Test: `test/game-data.test.js`

- [ ] **Step 1: Write the failing test**

`test/game-data.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLASSES } from '../js/game-data.js';

test('has all 13 playable classes', () => {
  assert.equal(Object.keys(CLASSES).length, 13);
});

test('Demon Hunter has the three Midnight specs including Devourer', () => {
  assert.deepEqual(CLASSES['Demon Hunter'], ['Havoc', 'Vengeance', 'Devourer']);
});

test('Druid has four specs', () => {
  assert.equal(CLASSES['Druid'].length, 4);
});

test('spec names are unique within a class', () => {
  for (const [cls, specs] of Object.entries(CLASSES)) {
    assert.equal(new Set(specs).size, specs.length, `${cls} has duplicate specs`);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../js/game-data.js'`

- [ ] **Step 3: Create `js/game-data.js` with the classes table**

Transcribed from spec §6.1.

```js
export const CLASSES = {
  'Death Knight': ['Blood', 'Frost', 'Unholy'],
  'Demon Hunter': ['Havoc', 'Vengeance', 'Devourer'],
  'Druid':        ['Balance', 'Feral', 'Guardian', 'Restoration'],
  'Evoker':       ['Devastation', 'Preservation', 'Augmentation'],
  'Hunter':       ['Beast Mastery', 'Marksmanship', 'Survival'],
  'Mage':         ['Arcane', 'Fire', 'Frost'],
  'Monk':         ['Brewmaster', 'Mistweaver', 'Windwalker'],
  'Paladin':      ['Holy', 'Protection', 'Retribution'],
  'Priest':       ['Discipline', 'Holy', 'Shadow'],
  'Rogue':        ['Assassination', 'Outlaw', 'Subtlety'],
  'Shaman':       ['Elemental', 'Enhancement', 'Restoration'],
  'Warlock':      ['Affliction', 'Demonology', 'Destruction'],
  'Warrior':      ['Arms', 'Fury', 'Protection'],
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add js/game-data.js test/game-data.test.js package.json
git commit -m "feat: class and spec reference table"
```

---

## Task 3: Role table with completeness guarantee

The bug that motivated this project (Devourer classified nowhere) is prevented by a test that every `(class, spec)` pair resolves to exactly one role.

**Files:**
- Modify: `js/game-data.js`
- Modify: `test/game-data.test.js`

- [ ] **Step 1: Write the failing test**

Append to `test/game-data.test.js`:

```js
import { CLASSES, ROLES, roleFor } from '../js/game-data.js';

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

test('roleFor returns null for unknown pairs', () => {
  assert.equal(roleFor('Mage', 'Blood'), null);
  assert.equal(roleFor('Mage', null), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `ROLES` and `roleFor` are not exported.

- [ ] **Step 3: Add the role table**

Append to `js/game-data.js`. Transcribed from spec §6.2.

```js
export const ROLE_ORDER = ['Tank', 'Melee DPS', 'Ranged DPS', 'Healer', 'Augvoker'];

export const ROLES = {
  'Tank': {
    'Death Knight': ['Blood'],
    'Demon Hunter': ['Vengeance'],
    'Druid':        ['Guardian'],
    'Monk':         ['Brewmaster'],
    'Paladin':      ['Protection'],
    'Warrior':      ['Protection'],
  },
  'Melee DPS': {
    'Death Knight': ['Frost', 'Unholy'],
    'Demon Hunter': ['Havoc'],
    'Druid':        ['Feral'],
    'Hunter':       ['Survival'],
    'Monk':         ['Windwalker'],
    'Paladin':      ['Retribution'],
    'Rogue':        ['Assassination', 'Outlaw', 'Subtlety'],
    'Shaman':       ['Enhancement'],
    'Warrior':      ['Arms', 'Fury'],
  },
  'Ranged DPS': {
    'Demon Hunter': ['Devourer'],
    'Druid':        ['Balance'],
    'Evoker':       ['Devastation'],
    'Hunter':       ['Beast Mastery', 'Marksmanship'],
    'Mage':         ['Arcane', 'Fire', 'Frost'],
    'Priest':       ['Shadow'],
    'Shaman':       ['Elemental'],
    'Warlock':      ['Affliction', 'Demonology', 'Destruction'],
  },
  'Healer': {
    'Druid':   ['Restoration'],
    'Evoker':  ['Preservation'],
    'Monk':    ['Mistweaver'],
    'Paladin': ['Holy'],
    'Priest':  ['Discipline', 'Holy'],
    'Shaman':  ['Restoration'],
  },
  'Augvoker': {
    'Evoker': ['Augmentation'],
  },
};

export function roleFor(cls, spec) {
  if (!cls || !spec) return null;
  for (const role of ROLE_ORDER) {
    if ((ROLES[role][cls] || []).includes(spec)) return role;
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add js/game-data.js test/game-data.test.js
git commit -m "feat: role table, with completeness assertion

Every (class, spec) pair must resolve to exactly one role. This is the
check that would have caught Devourer being classified nowhere."
```

---

## Task 4: Buff, utility, tier token and cooldown tables

**Files:**
- Modify: `js/game-data.js`
- Modify: `test/game-data.test.js`

Each entry has optional `classes` (any spec of that class counts) and optional `specs`
(that spec on any class counts) and optional `pairs` (exact class+spec). This mirrors
how the sheet's formulas were written.

- [ ] **Step 1: Write the failing test**

Append to `test/game-data.test.js`:

```js
import { BUFFS, UTILITY, TIER_TOKENS, COOLDOWNS, allSpecNames } from '../js/game-data.js';

test('every spec named in any table exists in CLASSES', () => {
  const valid = new Set(Object.values(CLASSES).flat());
  const bad = [...allSpecNames()].filter(s => !valid.has(s));
  assert.deepEqual(bad, [], 'unknown spec names — this catches Marksman/Marksmanship');
});

test('every class named in any table exists in CLASSES', () => {
  const tables = [...BUFFS, ...UTILITY, ...TIER_TOKENS, ...COOLDOWNS];
  const bad = [];
  for (const e of tables) {
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

test('Bloodlust excludes Hunter', () => {
  const bl = BUFFS.find(b => b.label === 'Bloodlust');
  assert.deepEqual(bl.classes, ['Mage', 'Shaman', 'Evoker']);
});

test('every class has exactly one tier token', () => {
  for (const cls of Object.keys(CLASSES)) {
    const n = TIER_TOKENS.filter(t => t.classes.includes(cls)).length;
    assert.equal(n, 1, `${cls} has ${n} tier tokens`);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — exports missing.

- [ ] **Step 3: Add the tables**

Append to `js/game-data.js`. Transcribed from spec §6.3–6.6.

```js
export const BUFFS = [
  { label: 'Intellect',                    classes: ['Mage'] },
  { label: 'Attack Power',                 classes: ['Warrior'] },
  { label: 'Stamina',                      classes: ['Priest'] },
  { label: '3% DR (Devo Aura)',            classes: ['Paladin'] },
  { label: '5% Physical',                  classes: ['Monk'] },
  { label: '3% Magic',                     classes: ['Demon Hunter'] },
  { label: '3% Versatility',               classes: ['Druid'] },
  { label: '3% Damage',                    classes: ['Hunter'] },
  { label: 'Bloodlust',                    classes: ['Mage', 'Shaman', 'Evoker'] },
  { label: 'Combat Res',                   classes: ['Druid', 'Warlock', 'Death Knight', 'Paladin'] },
  { label: 'Burst Move Speed',             classes: ['Druid', 'Shaman'] },
  { label: 'Lock Stuff (HS, Gate, Curse)', classes: ['Warlock'] },
  { label: 'Mass Dispel',                  classes: ['Priest'], specs: ['Mistweaver'] },
  { label: 'Innervate',                    classes: ['Druid'] },
  { label: 'Death Grip/AMZ',               classes: ['Death Knight'] },
  { label: 'Blessing of Protection',       classes: ['Paladin'] },
  { label: 'Rallying Cry',                 classes: ['Warrior'] },
  { label: 'Darkness',                     classes: ['Demon Hunter'] },
  { label: 'Immunities',                   classes: ['Paladin', 'Mage', 'Hunter'] },
  { label: 'Skyfury',                      classes: ['Shaman'] },
  { label: 'Boss DR',                      classes: ['Rogue'] },
  { label: 'Dragons',                      classes: ['Evoker'] },
  { label: 'Execute Damage',               classes: ['Warrior', 'Paladin', 'Priest', 'Hunter'], specs: ['Fire', 'Assassination'] },
  { label: 'Attack Speed Reduction',       classes: ['Rogue', 'Death Knight', 'Warlock'] },
  { label: 'Cast Speed Reduction',         classes: ['Rogue', 'Warlock'] },
];

export const UTILITY = [
  { label: 'Knock Up/Back',            classes: ['Evoker', 'Monk', 'Druid', 'Shaman', 'Hunter', 'Mage'] },
  { label: 'Mortal Strike',            classes: ['Rogue'], specs: ['Arms', 'Havoc'] },
  { label: 'Soothe',                   classes: ['Evoker', 'Monk', 'Druid', 'Hunter'] },
  { label: 'Purge',                    classes: ['Priest', 'Mage', 'Shaman', 'Hunter'] },
  { label: 'Power Infusion',           classes: ['Priest'] },
  { label: 'Extra Dam to Shields',     classes: ['Evoker', 'Warrior'] },
  { label: 'Cheat Death',              classes: ['Rogue'], specs: ['Augmentation', 'Fire', 'Vengeance', 'Blood'], pairs: [['Priest', 'Holy']] },
  { label: 'Blessing of Spellwarding', pairs: [['Paladin', 'Protection']] },
];

export const TIER_TOKENS = [
  { label: 'Dreadful (Cloth)',   classes: ['Priest', 'Mage', 'Warlock'] },
  { label: 'Mystic (Leather)',   classes: ['Druid', 'Monk', 'Rogue', 'Demon Hunter'] },
  { label: 'Venerated (Mail)',   classes: ['Evoker', 'Hunter', 'Shaman'] },
  { label: 'Zenith (Plate)',     classes: ['Paladin', 'Warrior', 'Death Knight'] },
];

export const COOLDOWNS = [
  { label: '1 and 1.5 min', specs: ['Fury', 'Enhancement', 'Retribution'] },
  { label: '2 min',         specs: ['Survival', 'Assassination', 'Subtlety', 'Devastation',
                                    'Affliction', 'Shadow', 'Fire', 'Marksmanship',
                                    'Augmentation', 'Feral', 'Havoc', 'Windwalker',
                                    'Demonology', 'Destruction', 'Beast Mastery'] },
  { label: '3 min',         specs: ['Balance', 'Unholy'] },
];

export function* allSpecNames() {
  for (const e of [...BUFFS, ...UTILITY, ...TIER_TOKENS, ...COOLDOWNS]) {
    for (const s of e.specs || []) yield s;
    for (const [, s] of e.pairs || []) yield s;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS, 15 tests.

- [ ] **Step 5: Commit**

```bash
git add js/game-data.js test/game-data.test.js
git commit -m "feat: buff, utility, tier token and cooldown tables

Spec-name closure test makes a Marksman/Marksmanship typo impossible."
```

---

## Task 5: Live roster fixture

**Files:**
- Create: `test/fixtures/live-roster.json`

This is Tim's roster as of 2026-07-29, transcribed from the Google Sheet. It is the
input to the parity test and must not be edited to make tests pass.

- [ ] **Step 1: Create the fixture**

```json
{
  "version": 1,
  "title": "Echoes of the Infinite — Midnight",
  "players": [
    { "id": "silence",      "name": "Silence",           "main": { "class": "Paladin",      "spec": "Retribution",   "offSpec": "Protection" },  "alt": { "class": "Warrior",      "spec": "Fury",        "offSpec": "Protection" }, "note": "Fuck portals. I am the light.", "status": "locked" },
    { "id": "bwinks",       "name": "Bwinks",            "main": { "class": "Paladin",      "spec": "Retribution",   "offSpec": null },          "alt": null, "note": "", "status": "locked" },
    { "id": "piwo",         "name": "Piwo",              "main": { "class": "Shaman",       "spec": "Restoration",   "offSpec": "Elemental" },   "alt": { "class": "Priest",       "spec": "Discipline",  "offSpec": "Shadow" }, "note": "It will be a healer class", "status": "locked" },
    { "id": "hygara",       "name": "Hygara",            "main": { "class": "Shaman",       "spec": "Enhancement",   "offSpec": null },          "alt": { "class": "Death Knight", "spec": "Unholy",      "offSpec": null }, "note": "Open to Alt-ing whatever, if needed", "status": "locked" },
    { "id": "gill-grunt",   "name": "Gill Grunt",        "main": { "class": "Monk",         "spec": "Brewmaster",    "offSpec": null },          "alt": { "class": "Demon Hunter", "spec": "Vengeance",   "offSpec": "Devourer" }, "note": "I dont like the guy below me", "status": "locked" },
    { "id": "emilios",      "name": "Emilios",           "main": { "class": "Hunter",       "spec": null,            "offSpec": null },          "alt": { "class": "Warlock",      "spec": "Demonology",  "offSpec": "Destruction" }, "note": "they guy above me smells funny", "status": "locked" },
    { "id": "bigwill",      "name": "BigWill",           "main": { "class": "Mage",         "spec": "Frost",         "offSpec": null },          "alt": { "class": "Demon Hunter", "spec": "Devourer",    "offSpec": null }, "note": "", "status": "locked" },
    { "id": "healer-way",   "name": "Healer of the Way", "main": { "class": "Monk",         "spec": "Mistweaver",    "offSpec": "Windwalker" },  "alt": { "class": "Druid",        "spec": "Feral",       "offSpec": "Restoration" }, "note": "Couldnt select \"All the Above\" for alt class for some reason....", "status": "locked" },
    { "id": "raevive",      "name": "Raevive",           "main": { "class": "Priest",       "spec": "Holy",          "offSpec": "Shadow" },      "alt": { "class": "Druid",        "spec": "Restoration", "offSpec": "Guardian" }, "note": "I don't mind tanking or healing whatevers more needed :)", "status": "locked" },
    { "id": "pwandacookie", "name": "Pwandacookie",      "main": { "class": "Mage",         "spec": "Arcane",        "offSpec": "Fire" },        "alt": { "class": "Warlock",      "spec": "Demonology",  "offSpec": null }, "note": "", "status": "locked" },
    { "id": "valadrim",     "name": "Valadrim",          "main": { "class": "Mage",         "spec": "Arcane",        "offSpec": "Fire" },        "alt": { "class": "Rogue",        "spec": "Assassination", "offSpec": "Outlaw" }, "note": "", "status": "locked" },
    { "id": "plumis",       "name": "Plumis",            "main": { "class": "Warrior",      "spec": "Arms",          "offSpec": null },          "alt": null, "note": "", "status": "locked" },
    { "id": "mortal",       "name": "Mortal",            "main": { "class": "Demon Hunter", "spec": "Devourer",      "offSpec": "Vengeance" },   "alt": { "class": "Monk",         "spec": "Brewmaster",  "offSpec": null }, "note": "either havoc or devour is no one else is on that train", "status": "locked" },
    { "id": "lump",         "name": "Lump",              "main": { "class": "Warrior",      "spec": "Fury",          "offSpec": null },          "alt": null, "note": "", "status": "locked" },
    { "id": "vickyicky",    "name": "Vickyicky",         "main": { "class": "Druid",        "spec": "Restoration",   "offSpec": "Balance" },     "alt": null, "note": "", "status": "locked" },
    { "id": "gwarrar",      "name": "Gwarrar",           "main": { "class": "Death Knight", "spec": "Blood",         "offSpec": "Frost" },       "alt": { "class": "Demon Hunter", "spec": "Vengeance",   "offSpec": "Devourer" }, "note": "", "status": "locked" },
    { "id": "haeyr",        "name": "Haeyr",             "main": { "class": "Shaman",       "spec": "Elemental",     "offSpec": "Enhancement" }, "alt": { "class": "Demon Hunter", "spec": "Devourer",    "offSpec": null }, "note": "", "status": "locked" },
    { "id": "radoodoo",     "name": "Radoodoo",          "main": { "class": "Hunter",       "spec": "Marksmanship",  "offSpec": null },          "alt": null, "note": "", "status": "locked" },
    { "id": "gobanks",      "name": "Gobanks",           "main": { "class": "Paladin",      "spec": "Retribution",   "offSpec": null },          "alt": null, "note": "", "status": "locked" },
    { "id": "caseus",       "name": "Caseus (CHEESE)",   "main": { "class": "Warlock",      "spec": "Demonology",    "offSpec": "Destruction" }, "alt": { "class": "Warrior",      "spec": "Fury",        "offSpec": "Arms" }, "note": "I also have a Paladin or DK DPS I'm willing to play if needed.", "status": "locked" },
    { "id": "nitrogenburn", "name": "Nitrogenburn",      "main": { "class": "Mage",         "spec": "Frost",         "offSpec": "Fire" },        "alt": null, "note": "", "status": "locked" },
    { "id": "biefcake",     "name": "Biefcake",          "main": { "class": "Death Knight", "spec": "Unholy",        "offSpec": "Frost" },       "alt": { "class": "Warrior",      "spec": "Protection",  "offSpec": "Fury" }, "note": "Literally have an 80 of every class cept Evoker and Demonhunter", "status": "locked" },
    { "id": "feltigress",   "name": "FelTigress",        "main": { "class": "Druid",        "spec": "Feral",         "offSpec": null },          "alt": null, "note": "", "status": "locked" },
    { "id": "frosht",       "name": "Frosht",            "main": { "class": "Mage",         "spec": "Frost",         "offSpec": null },          "alt": null, "note": "", "status": "locked" },
    { "id": "bronwinn",     "name": "Bronwinn",          "main": { "class": "Paladin",      "spec": "Retribution",   "offSpec": null },          "alt": { "class": "Demon Hunter", "spec": "Devourer",    "offSpec": "Havoc" }, "note": "", "status": "bench" }
  ]
}
```

- [ ] **Step 2: Verify it parses and has the expected shape**

Run:
```bash
node -e "const r=require('fs').readFileSync('test/fixtures/live-roster.json','utf8');const j=JSON.parse(r);console.log('players',j.players.length,'locked',j.players.filter(p=>p.status==='locked').length,'bench',j.players.filter(p=>p.status==='bench').length)"
```
Expected: `players 25 locked 24 bench 1`

- [ ] **Step 3: Commit**

```bash
git add test/fixtures/live-roster.json
git commit -m "test: live roster fixture, 2026-07-29 (24 locked, 1 benched)"
```

---

## Task 6: Compute engine — role and class counts

**Counting semantics**, replicating the sheet:

- **Main** counts consider `(main.class, main.spec)` and only for `status === 'locked'`.
  (The sheet filters `bench,"FALSE"`.)
- **Alt** counts consider three pairs, for players of *any* status:
  `(main.class, main.offSpec)`, `(alt.class, alt.spec)`, `(alt.class, alt.offSpec)`.
  The sheet counts these over columns D–G with no bench filter.
- Class-based alt counts use `alt.class` only, matching the sheet's `altclass` range.

**Files:**
- Create: `js/compute.js`
- Test: `test/compute.test.js`

- [ ] **Step 1: Write the failing test**

`test/compute.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeAll } from '../js/compute.js';

const roster = JSON.parse(readFileSync(new URL('./fixtures/live-roster.json', import.meta.url)));
const d = computeAll(roster);
const byLabel = (rows, label) => rows.find(r => r.label === label);

test('counts 24 locked in', () => {
  assert.equal(d.totals.lockedIn, 24);
});

test('role main counts match hand-verified values', () => {
  assert.equal(byLabel(d.roles, 'Tank').main, 2);
  assert.equal(byLabel(d.roles, 'Melee DPS').main, 8);
  assert.equal(byLabel(d.roles, 'Ranged DPS').main, 9);
  assert.equal(byLabel(d.roles, 'Healer').main, 4);
  assert.equal(byLabel(d.roles, 'Augvoker').main, 0);
});

test('role totals reconcile against locked-in count', () => {
  const sum = d.roles.reduce((a, r) => a + r.main, 0);
  assert.equal(sum + d.incomplete.length, d.totals.lockedIn,
    'roles + incomplete must equal locked-in — this is the Devourer check');
});

test('Emilios is the only incomplete player', () => {
  assert.deepEqual(d.incomplete.map(p => p.name), ['Emilios']);
});

test('class main counts match the sheet', () => {
  const expect = { 'Death Knight': 2, 'Demon Hunter': 1, 'Evoker': 0, 'Druid': 2,
                   'Hunter': 2, 'Mage': 5, 'Monk': 2, 'Paladin': 3, 'Priest': 1,
                   'Rogue': 0, 'Shaman': 3, 'Warlock': 1, 'Warrior': 2 };
  for (const [cls, n] of Object.entries(expect)) {
    assert.equal(byLabel(d.classes, cls).main, n, `${cls} main`);
  }
});

test('class main counts sum to locked-in count', () => {
  assert.equal(d.classes.reduce((a, c) => a + c.main, 0), 24);
});
```

Note `Ranged DPS` is **9**, not the sheet's 8 — Mortal (Devourer) now counts. That is
fix §7.1 asserted directly.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../js/compute.js'`

- [ ] **Step 3: Implement `js/compute.js`**

```js
import { CLASSES, ROLE_ORDER, roleFor } from './game-data.js';

const isLocked = p => p.status === 'locked';

// (class, spec) pairs a player contributes to MAIN counts
export function mainPairs(p) {
  if (!isLocked(p) || !p.main?.class || !p.main?.spec) return [];
  return [[p.main.class, p.main.spec]];
}

// (class, spec) pairs a player contributes to ALT counts, any status
export function altPairs(p) {
  const out = [];
  if (p.main?.class && p.main?.offSpec) out.push([p.main.class, p.main.offSpec]);
  if (p.alt?.class) {
    if (p.alt.spec)    out.push([p.alt.class, p.alt.spec]);
    if (p.alt.offSpec) out.push([p.alt.class, p.alt.offSpec]);
  }
  return out;
}

const mainClassOf = p => (isLocked(p) && p.main?.class) ? p.main.class : null;
const altClassOf  = p => p.alt?.class || null;

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
  return Object.keys(CLASSES).sort().map(label => ({
    label,
    main: players.filter(p => mainClassOf(p) === label).length,
    alt:  players.filter(p => altClassOf(p)  === label).length,
  }));
}

export function computeAll(roster) {
  const players = roster.players || [];
  const locked = players.filter(isLocked);
  return {
    roles:   countRoles(players),
    classes: countClasses(players),
    incomplete: locked.filter(p => !p.main?.class || !p.main?.spec),
    totals: { lockedIn: locked.length, bench: players.filter(p => p.status === 'bench').length },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS, 21 tests.

- [ ] **Step 5: Commit**

```bash
git add js/compute.js test/compute.test.js
git commit -m "feat: role and class counts

Ranged DPS is 9 not 8 — Mortal (Devourer) now counted. Role totals
reconcile against locked-in count, which is the regression guard."
```

---

## Task 7: Compute engine — buffs, utility, tier tokens, cooldowns

**Files:**
- Modify: `js/compute.js`
- Modify: `test/compute.test.js`

- [ ] **Step 1: Write the failing test**

Append to `test/compute.test.js`:

```js
test('buff main counts match the sheet', () => {
  const expect = { 'Intellect': 5, 'Attack Power': 2, 'Stamina': 1, '3% DR (Devo Aura)': 3,
                   '5% Physical': 2, '3% Magic': 1, '3% Versatility': 2, '3% Damage': 2,
                   'Bloodlust': 8, 'Combat Res': 8, 'Burst Move Speed': 5,
                   'Lock Stuff (HS, Gate, Curse)': 1, 'Mass Dispel': 2, 'Innervate': 2,
                   'Death Grip/AMZ': 2, 'Blessing of Protection': 3, 'Rallying Cry': 2,
                   'Darkness': 1, 'Immunities': 10, 'Skyfury': 3, 'Boss DR': 0,
                   'Dragons': 0, 'Execute Damage': 8, 'Attack Speed Reduction': 3,
                   'Cast Speed Reduction': 1 };
  for (const [label, n] of Object.entries(expect)) {
    assert.equal(byLabel(d.buffs, label).main, n, `${label} main`);
  }
});

test('utility main counts match the sheet', () => {
  const expect = { 'Knock Up/Back': 14, 'Mortal Strike': 1, 'Soothe': 6, 'Purge': 11,
                   'Power Infusion': 1, 'Extra Dam to Shields': 2, 'Cheat Death': 2,
                   'Blessing of Spellwarding': 0 };
  for (const [label, n] of Object.entries(expect)) {
    assert.equal(byLabel(d.utility, label).main, n, `${label} main`);
  }
});

test('tier token main counts match the sheet', () => {
  assert.equal(byLabel(d.tierTokens, 'Dreadful (Cloth)').main, 7);
  assert.equal(byLabel(d.tierTokens, 'Mystic (Leather)').main, 5);
  assert.equal(byLabel(d.tierTokens, 'Venerated (Mail)').main, 5);
  assert.equal(byLabel(d.tierTokens, 'Zenith (Plate)').main, 7);
});

test('tier tokens partition the locked roster', () => {
  assert.equal(d.tierTokens.reduce((a, t) => a + t.main, 0), 24);
});

test('2 min cooldown profile is 3, not the sheet\'s 2', () => {
  assert.equal(byLabel(d.cooldowns, '2 min').main, 3);
});

test('cooldown profiles report unassigned specs', () => {
  assert.ok(d.cooldownUnassigned.main > 0,
    'Arcane/Frost/Elemental/Devourer have no profile in the source template');
});
```

`2 min` is **3**, not the sheet's 2 — Radoodoo (Marksmanship) now counts. Fix §7.3
asserted directly. `3% Damage` alt is unaffected on this roster (no Hunter alts) but the
table is corrected per §7.2.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `d.buffs` is undefined.

- [ ] **Step 3: Extend `js/compute.js`**

Add before `computeAll`, and extend its return value:

```js
import { BUFFS, UTILITY, TIER_TOKENS, COOLDOWNS } from './game-data.js';

function matches(entry, cls, spec) {
  if ((entry.classes || []).includes(cls)) return true;
  if ((entry.specs || []).includes(spec)) return true;
  if ((entry.pairs || []).some(([c, s]) => c === cls && s === spec)) return true;
  return false;
}

function countTable(entries, players) {
  return entries.map(e => ({
    label: e.label,
    main: players.reduce((a, p) => a + mainPairs(p).filter(([c, s]) => matches(e, c, s)).length, 0),
    alt:  players.reduce((a, p) => a + altPairs(p).filter(([c, s]) => matches(e, c, s)).length, 0),
  }));
}

function countUnassigned(entries, players) {
  const covered = new Set(entries.flatMap(e => e.specs || []));
  const tally = pairs => players.reduce(
    (a, p) => a + pairs(p).filter(([, s]) => s && !covered.has(s)).length, 0);
  return { main: tally(mainPairs), alt: tally(altPairs) };
}
```

Extend the `computeAll` return object with:

```js
    buffs:      countTable(BUFFS,       players),
    utility:    countTable(UTILITY,     players),
    tierTokens: countTable(TIER_TOKENS, players),
    cooldowns:  countTable(COOLDOWNS,   players),
    cooldownUnassigned: countUnassigned(COOLDOWNS, players),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS, 27 tests.

If a buff main count is off, the reference table in `game-data.js` is wrong — do **not**
edit the fixture or the expected values to make it green. The expected values are
transcribed from the live sheet and are the specification.

- [ ] **Step 5: Commit**

```bash
git add js/compute.js test/compute.test.js
git commit -m "feat: buff, utility, tier token and cooldown counts

All 25 buff and 8 utility main counts asserted against the live sheet.
2 min CD profile is 3 not 2 — Marksmanship now matches."
```

---

## Task 8: Roster UI

**Files:**
- Create: `index.html`, `css/styles.css`, `js/roster-ui.js`

- [ ] **Step 1: Create `index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Raid Roster</title>
  <link rel="stylesheet" href="css/styles.css">
</head>
<body>
  <header>
    <h1 id="title">Raid Roster</h1>
    <nav>
      <button data-tab="roster" class="active">Roster</button>
      <button data-tab="coverage">Coverage</button>
      <button data-tab="history">History</button>
    </nav>
    <div id="save-bar"><span id="status"></span><button id="save">Save</button></div>
  </header>
  <main>
    <section id="tab-roster"></section>
    <section id="tab-coverage" hidden></section>
    <section id="tab-history" hidden></section>
  </main>
  <script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `js/roster-ui.js`**

```js
import { CLASSES } from './game-data.js';

const STATUSES = ['locked', 'bench', 'out'];

function option(value, selected) {
  const o = document.createElement('option');
  o.value = value ?? '';
  o.textContent = value ?? '—';
  o.selected = (value ?? '') === (selected ?? '');
  return o;
}

function classSelect(value, onChange) {
  const s = document.createElement('select');
  s.append(option(null, value), ...Object.keys(CLASSES).map(c => option(c, value)));
  s.onchange = () => onChange(s.value || null);
  return s;
}

function specSelect(cls, value, onChange) {
  const s = document.createElement('select');
  s.append(option(null, value), ...(CLASSES[cls] || []).map(sp => option(sp, value)));
  s.disabled = !cls;
  s.onchange = () => onChange(s.value || null);
  return s;
}

export function renderRoster(root, roster, onChange) {
  root.replaceChildren();
  const table = document.createElement('table');
  table.className = 'roster';
  table.innerHTML = `<thead><tr>
    <th>Player</th><th>Main Class</th><th>Main Spec</th><th>Off Spec</th>
    <th>Alt Class</th><th>Alt Spec</th><th>Alt Off Spec</th>
    <th>Note</th><th>Status</th><th></th></tr></thead>`;
  const body = document.createElement('tbody');

  roster.players.forEach((p, i) => {
    const tr = document.createElement('tr');
    if (p.status === 'locked' && (!p.main?.class || !p.main?.spec)) tr.classList.add('incomplete');

    const name = document.createElement('input');
    name.value = p.name;
    name.oninput = () => { p.name = name.value; onChange(); };

    const set = (path, v) => { path(v); onChange(); };
    p.alt ??= { class: null, spec: null, offSpec: null };

    const cells = [
      name,
      classSelect(p.main.class, v => set(x => { p.main.class = x; p.main.spec = null; p.main.offSpec = null; }, v)),
      specSelect(p.main.class, p.main.spec,    v => set(x => p.main.spec = x, v)),
      specSelect(p.main.class, p.main.offSpec, v => set(x => p.main.offSpec = x, v)),
      classSelect(p.alt.class, v => set(x => { p.alt.class = x; p.alt.spec = null; p.alt.offSpec = null; }, v)),
      specSelect(p.alt.class, p.alt.spec,    v => set(x => p.alt.spec = x, v)),
      specSelect(p.alt.class, p.alt.offSpec, v => set(x => p.alt.offSpec = x, v)),
    ];

    const note = document.createElement('input');
    note.value = p.note || '';
    note.oninput = () => { p.note = note.value; onChange(); };
    cells.push(note);

    const status = document.createElement('select');
    status.append(...STATUSES.map(s => option(s, p.status)));
    status.onchange = () => { p.status = status.value; onChange(); };
    cells.push(status);

    const del = document.createElement('button');
    del.textContent = '×';
    del.title = 'Remove player';
    del.onclick = () => { roster.players.splice(i, 1); onChange(); };
    cells.push(del);

    for (const c of cells) { const td = document.createElement('td'); td.append(c); tr.append(td); }
    body.append(tr);
  });

  table.append(body);
  const add = document.createElement('button');
  add.textContent = '+ Add player';
  add.onclick = () => {
    roster.players.push({ id: `p${Date.now()}`, name: '',
      main: { class: null, spec: null, offSpec: null },
      alt: { class: null, spec: null, offSpec: null }, note: '', status: 'locked' });
    onChange();
  };
  root.append(table, add);
}
```

- [ ] **Step 3: Create `css/styles.css`**

```css
:root { color-scheme: dark; --bg:#15171c; --fg:#e6e6e6; --line:#2c2f36; --warn:#e0a030; --zero:#c04040; }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--fg); font:14px/1.4 system-ui, sans-serif; }
header { display:flex; gap:1rem; align-items:center; padding:.75rem 1rem; border-bottom:1px solid var(--line); flex-wrap:wrap; }
h1 { font-size:1rem; margin:0; }
nav button { background:none; border:1px solid var(--line); color:var(--fg); padding:.35rem .8rem; cursor:pointer; }
nav button.active { background:var(--line); }
#save-bar { margin-left:auto; display:flex; gap:.5rem; align-items:center; }
main { padding:1rem; overflow-x:auto; }
table { border-collapse:collapse; }
th, td { border:1px solid var(--line); padding:.2rem .4rem; text-align:left; }
input, select { background:#1d2027; color:var(--fg); border:1px solid var(--line); padding:.2rem; font:inherit; }
tr.incomplete td:first-child { border-left:3px solid var(--warn); }
.grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:1rem; align-items:start; }
.block h2 { font-size:.85rem; text-transform:uppercase; letter-spacing:.05em; opacity:.7; margin:0 0 .4rem; }
td.zero { color:var(--zero); font-weight:bold; }
td.num { text-align:right; font-variant-numeric:tabular-nums; }
.commit { border-bottom:1px solid var(--line); padding:.6rem 0; }
.commit time { opacity:.6; margin-left:.5rem; }
```

- [ ] **Step 4: Verify visually**

Serve and open: `npx serve .` then load the roster tab. Confirm selecting a class
repopulates its spec dropdowns and clears stale spec values.

- [ ] **Step 5: Commit**

```bash
git add index.html css/styles.css js/roster-ui.js
git commit -m "feat: roster table UI with dependent spec dropdowns"
```

---

## Task 9: Coverage UI

**Files:**
- Create: `js/coverage-ui.js`

- [ ] **Step 1: Create `js/coverage-ui.js`**

```js
function block(title, rows, opts = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'block';
  const h = document.createElement('h2');
  h.textContent = title;
  const t = document.createElement('table');
  t.innerHTML = '<thead><tr><th></th><th>Main</th><th>Offspec/Alt</th></tr></thead>';
  const b = document.createElement('tbody');
  for (const r of rows) {
    const tr = document.createElement('tr');
    const label = document.createElement('td'); label.textContent = r.label;
    const main = document.createElement('td');  main.textContent = r.main; main.className = 'num';
    const alt = document.createElement('td');   alt.textContent = r.alt;  alt.className = 'num';
    if (opts.flagZero && r.main === 0) main.classList.add('zero');
    tr.append(label, main, alt);
    b.append(tr);
  }
  t.append(b);
  wrap.append(h, t);
  return wrap;
}

export function renderCoverage(root, d) {
  root.replaceChildren();
  const grid = document.createElement('div');
  grid.className = 'grid';

  const roles = [...d.roles];
  if (d.incomplete.length) roles.push({ label: 'Incomplete', main: d.incomplete.length, alt: 0 });

  const cds = [...d.cooldowns];
  if (d.cooldownUnassigned.main || d.cooldownUnassigned.alt) {
    cds.push({ label: 'Unassigned', main: d.cooldownUnassigned.main, alt: d.cooldownUnassigned.alt });
  }

  grid.append(
    block('Raid Roles', roles),
    block('Classes', d.classes),
    block('Major Buffs/Debuffs', d.buffs, { flagZero: true }),
    block('Tier Token', d.tierTokens),
    block('Utility', d.utility, { flagZero: true }),
    block('Cooldown Profiles', cds),
  );

  const summary = document.createElement('p');
  const roleSum = d.roles.reduce((a, r) => a + r.main, 0);
  summary.textContent =
    `${d.totals.lockedIn} locked in, ${d.totals.bench} benched. ` +
    `Roles account for ${roleSum} + ${d.incomplete.length} incomplete.`;
  root.append(summary, grid);
}
```

- [ ] **Step 2: Verify visually**

Load the Coverage tab against the live roster. Confirm Raid Roles reads
Tank 2 / Melee 8 / Ranged 9 / Healer 4 / Augvoker 0, plus Incomplete 1, and the summary
line reconciles to 24.

- [ ] **Step 3: Commit**

```bash
git add js/coverage-ui.js
git commit -m "feat: coverage panel, six derived blocks

Zero-coverage buffs and utilities highlighted; unassigned cooldown specs
surfaced rather than silently dropped."
```

---

## Task 10: API client and app wiring

**Files:**
- Create: `js/api.js`, `js/app.js`, `data/roster.json`

- [ ] **Step 1: Seed `data/roster.json`**

```bash
cp test/fixtures/live-roster.json data/roster.json
```

- [ ] **Step 2: Create `js/api.js`**

```js
const REPO = 'revelation343/raid-roster';
const WORKER = 'https://raid-roster.<subdomain>.workers.dev';
const PATH = 'data/roster.json';

export async function loadRoster() {
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${PATH}`,
    { headers: { Accept: 'application/vnd.github.raw+json' }, cache: 'no-store' });
  if (!res.ok) throw new Error(`Load failed: ${res.status}`);
  const sha = await currentSha();
  return { roster: await res.json(), sha };
}

async function currentSha() {
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${PATH}`);
  if (!res.ok) throw new Error(`SHA fetch failed: ${res.status}`);
  return (await res.json()).sha;
}

export async function saveRoster({ roster, sha, actor, summary, details, passphrase }) {
  const res = await fetch(`${WORKER}/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roster, sha, actor, summary, details, passphrase }),
  });
  if (res.status === 409) throw new Error('STALE');
  if (res.status === 401) throw new Error('BAD_PASSPHRASE');
  if (!res.ok) throw new Error(`Save failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function loadHistory() {
  const res = await fetch(`https://api.github.com/repos/${REPO}/commits?path=${PATH}&per_page=50`);
  if (!res.ok) throw new Error(`History failed: ${res.status}`);
  return res.json();
}

export async function loadVersion(sha) {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${PATH}?ref=${sha}`,
    { headers: { Accept: 'application/vnd.github.raw+json' } });
  if (!res.ok) throw new Error(`Version fetch failed: ${res.status}`);
  return res.json();
}
```

Replace `<subdomain>` with the real Worker subdomain in Task 12.

- [ ] **Step 3: Create `js/app.js`**

```js
import { loadRoster, saveRoster } from './api.js';
import { computeAll } from './compute.js';
import { renderRoster } from './roster-ui.js';
import { renderCoverage } from './coverage-ui.js';
import { renderHistory } from './history-ui.js';

const el = id => document.getElementById(id);
let state = { roster: null, sha: null, dirty: false };

function diffSummary(before, after) {
  const b = new Map(before.players.map(p => [p.id, p]));
  const changes = [];
  for (const p of after.players) {
    const old = b.get(p.id);
    if (!old) { changes.push(`added ${p.name}`); continue; }
    const fields = [
      ['main spec',    old.main?.spec,    p.main?.spec],
      ['off-spec',     old.main?.offSpec, p.main?.offSpec],
      ['main class',   old.main?.class,   p.main?.class],
      ['alt class',    old.alt?.class,    p.alt?.class],
      ['alt spec',     old.alt?.spec,     p.alt?.spec],
      ['alt off-spec', old.alt?.offSpec,  p.alt?.offSpec],
      ['status',       old.status,        p.status],
      ['note',         old.note,          p.note],
    ];
    for (const [name, o, n] of fields) {
      if ((o ?? '') !== (n ?? '')) changes.push(`${p.name} ${name}: ${o ?? '—'} → ${n ?? '—'}`);
    }
  }
  for (const p of before.players) if (!after.players.some(q => q.id === p.id)) changes.push(`removed ${p.name}`);
  return changes;
}

function actorName() {
  let a = localStorage.getItem('actor');
  if (!a) { a = prompt('Your name (shown in the change log):') || 'anonymous'; localStorage.setItem('actor', a); }
  return a;
}

function passphrase() {
  let p = localStorage.getItem('passphrase');
  if (!p) { p = prompt('Guild passphrase:') || ''; localStorage.setItem('passphrase', p); }
  return p;
}

let pristine = null;

function rerender() {
  renderRoster(el('tab-roster'), state.roster, () => { state.dirty = true; rerender(); });
  renderCoverage(el('tab-coverage'), computeAll(state.roster));
  el('status').textContent = state.dirty ? 'unsaved changes' : '';
  el('title').textContent = state.roster.title || 'Raid Roster';
}

el('save').onclick = async () => {
  const changes = diffSummary(pristine, state.roster);
  if (!changes.length) { el('status').textContent = 'nothing to save'; return; }
  el('save').disabled = true;
  el('status').textContent = 'saving…';
  try {
    const { sha } = await saveRoster({
      roster: state.roster, sha: state.sha, actor: actorName(),
      summary: changes[0] + (changes.length > 1 ? ` (+${changes.length - 1} more)` : ''),
      details: changes, passphrase: passphrase(),
    });
    state.sha = sha;
    pristine = structuredClone(state.roster);
    state.dirty = false;
    el('status').textContent = 'saved';
  } catch (e) {
    if (e.message === 'STALE') {
      el('status').textContent = 'Someone else saved first — reloading.';
      setTimeout(() => location.reload(), 1500);
    } else if (e.message === 'BAD_PASSPHRASE') {
      localStorage.removeItem('passphrase');
      el('status').textContent = 'Wrong passphrase — try again.';
    } else {
      el('status').textContent = e.message;
    }
  } finally {
    el('save').disabled = false;
  }
};

for (const b of document.querySelectorAll('nav button')) {
  b.onclick = () => {
    for (const x of document.querySelectorAll('nav button')) x.classList.toggle('active', x === b);
    for (const t of ['roster', 'coverage', 'history']) el(`tab-${t}`).hidden = t !== b.dataset.tab;
    if (b.dataset.tab === 'history') renderHistory(el('tab-history'), r => {
      state.roster = r; pristine = structuredClone(r); state.dirty = true; rerender();
    });
  };
}

(async () => {
  try {
    const { roster, sha } = await loadRoster();
    state = { roster, sha, dirty: false };
    pristine = structuredClone(roster);
    rerender();
  } catch (e) {
    el('tab-roster').textContent = `Could not load roster: ${e.message}`;
  }
})();
```

- [ ] **Step 4: Commit**

```bash
git add js/api.js js/app.js data/roster.json
git commit -m "feat: api client, app wiring, seeded roster data"
```

---

## Task 11: History UI

**Files:**
- Create: `js/history-ui.js`

- [ ] **Step 1: Create `js/history-ui.js`**

```js
import { loadHistory, loadVersion } from './api.js';

export async function renderHistory(root, onRestore) {
  root.replaceChildren();
  root.textContent = 'Loading history…';
  let commits;
  try { commits = await loadHistory(); }
  catch (e) { root.textContent = `Could not load history: ${e.message}`; return; }

  root.replaceChildren();
  if (!commits.length) { root.textContent = 'No history yet.'; return; }

  for (const c of commits) {
    const div = document.createElement('div');
    div.className = 'commit';

    const [subject, ...rest] = c.commit.message.split('\n');
    const head = document.createElement('div');
    head.textContent = subject;
    const when = document.createElement('time');
    when.textContent = new Date(c.commit.author.date).toLocaleString();
    head.append(when);

    const body = rest.join('\n').trim();
    if (body) {
      const pre = document.createElement('pre');
      pre.textContent = body;
      div.append(head, pre);
    } else {
      div.append(head);
    }

    const btn = document.createElement('button');
    btn.textContent = 'Restore this version';
    btn.onclick = async () => {
      if (!confirm(`Restore the roster as of "${subject}"?\n\nThis loads it into the editor; you still have to press Save.`)) return;
      btn.disabled = true;
      try { onRestore(await loadVersion(c.sha)); }
      catch (e) { alert(`Restore failed: ${e.message}`); btn.disabled = false; }
    };
    div.append(btn);
    root.append(div);
  }
}
```

Restore loads the old version into the editor and marks it dirty; the user still
presses Save. That keeps every restore itself a normal, attributed commit.

- [ ] **Step 2: Commit**

```bash
git add js/history-ui.js
git commit -m "feat: history tab with restore-to-version"
```

---

## Task 12: Cloudflare Worker

**Files:**
- Create: `worker/index.js`, `worker/wrangler.toml`
- Test: `test/worker-validate.test.js`

- [ ] **Step 1: Write the failing validation test**

`test/worker-validate.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateRoster } from '../worker/validate.js';

const good = JSON.parse(readFileSync(new URL('./fixtures/live-roster.json', import.meta.url)));

test('accepts the live roster', () => {
  assert.equal(validateRoster(good), null);
});

test('rejects an unknown class', () => {
  const bad = structuredClone(good);
  bad.players[0].main.class = 'Tinker';
  assert.match(validateRoster(bad), /unknown class/i);
});

test('rejects a spec that does not belong to its class', () => {
  const bad = structuredClone(good);
  bad.players[0].main.spec = 'Frost';
  assert.match(validateRoster(bad), /not a .* spec/i);
});

test('rejects a bad status', () => {
  const bad = structuredClone(good);
  bad.players[0].status = 'benched';
  assert.match(validateRoster(bad), /status/i);
});

test('rejects a non-array players field', () => {
  assert.match(validateRoster({ players: 'nope' }), /players/i);
});

test('rejects an oversized roster', () => {
  const bad = { players: Array.from({ length: 501 }, () => structuredClone(good.players[0])) };
  assert.match(validateRoster(bad), /too many/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../worker/validate.js'`

- [ ] **Step 3: Create `worker/validate.js`**

```js
import { CLASSES } from '../js/game-data.js';

const STATUSES = new Set(['locked', 'bench', 'out']);

function checkSpec(cls, spec, where) {
  if (spec == null) return null;
  if (!CLASSES[cls]) return `${where}: unknown class ${cls}`;
  if (!CLASSES[cls].includes(spec)) return `${where}: ${spec} is not a ${cls} spec`;
  return null;
}

export function validateRoster(roster) {
  if (!roster || typeof roster !== 'object') return 'roster must be an object';
  if (!Array.isArray(roster.players)) return 'players must be an array';
  if (roster.players.length > 500) return 'too many players';

  for (const [i, p] of roster.players.entries()) {
    const at = `player ${i}`;
    if (typeof p.name !== 'string' || p.name.length > 64) return `${at}: bad name`;
    if (typeof p.note !== 'string' || p.note.length > 500) return `${at}: bad note`;
    if (!STATUSES.has(p.status)) return `${at}: bad status ${p.status}`;

    for (const [key, side] of [['main', p.main], ['alt', p.alt]]) {
      if (side == null) continue;
      if (side.class != null && !CLASSES[side.class]) return `${at} ${key}: unknown class ${side.class}`;
      for (const f of ['spec', 'offSpec']) {
        const err = checkSpec(side.class, side[f], `${at} ${key}.${f}`);
        if (err) return err;
      }
    }
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS, 33 tests.

- [ ] **Step 5: Create `worker/index.js`**

```js
import { validateRoster } from './validate.js';

const REPO = 'revelation343/raid-roster';
const PATH = 'data/roster.json';

const json = (obj, status = 200, origin = '*') => new Response(JSON.stringify(obj), {
  status,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  },
});

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || '*';
    if (request.method === 'OPTIONS') return json({}, 204, origin);
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405, origin);

    let body;
    try { body = await request.json(); }
    catch { return json({ error: 'bad JSON' }, 400, origin); }

    const { roster, sha, actor, summary, details, passphrase } = body;
    if (passphrase !== env.GUILD_PASSPHRASE) return json({ error: 'bad passphrase' }, 401, origin);

    const invalid = validateRoster(roster);
    if (invalid) return json({ error: invalid }, 400, origin);

    if (typeof sha !== 'string' || !sha) return json({ error: 'missing sha' }, 400, origin);
    const who = (typeof actor === 'string' && actor.trim()) ? actor.trim().slice(0, 64) : 'anonymous';
    const subject = (typeof summary === 'string' ? summary : 'roster update').slice(0, 120);
    const lines = Array.isArray(details) ? details.slice(0, 100).map(String) : [];
    const message = `${who}: ${subject}\n\n${lines.join('\n')}`.trim();

    const content = btoa(unescape(encodeURIComponent(JSON.stringify(roster, null, 2) + '\n')));

    const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${PATH}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'raid-roster-worker',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message, content, sha,
        committer: { name: who, email: 'raid-roster@users.noreply.github.com' },
      }),
    });

    if (res.status === 409) return json({ error: 'stale' }, 409, origin);
    if (!res.ok) return json({ error: `github ${res.status}`, detail: await res.text() }, 502, origin);

    const out = await res.json();
    return json({ sha: out.content.sha }, 200, origin);
  },
};
```

- [ ] **Step 6: Create `worker/wrangler.toml`**

```toml
name = "raid-roster"
main = "index.js"
compatibility_date = "2026-07-01"

[vars]
ALLOWED_ORIGIN = "https://revelation343.github.io"
```

`GITHUB_TOKEN` and `GUILD_PASSPHRASE` are secrets, never in this file:

```bash
cd worker
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put GUILD_PASSPHRASE
```

- [ ] **Step 7: Commit**

```bash
git add worker/ test/worker-validate.test.js
git commit -m "feat: cloudflare worker save endpoint with schema validation

Worker shares game-data.js with the client, so an unknown class or a spec
that does not belong to its class cannot be committed."
```

---

## Task 13: Deploy

Requires Tim's explicit go-ahead — creating the repo publishes the roster.

- [ ] **Step 1: Create the public repo and push**

```bash
cd /e/Development/WoW/raid-roster
gh repo create revelation343/raid-roster --public --source=. --remote=origin --push
```

- [ ] **Step 2: Enable Pages**

```bash
gh api -X POST repos/revelation343/raid-roster/pages -f "source[branch]=main" -f "source[path]=/"
```

- [ ] **Step 3: Create a fine-grained GitHub token**

Scope it to `revelation343/raid-roster` only, with **Contents: Read and write**. Nothing
else. Create at https://github.com/settings/personal-access-tokens/new

- [ ] **Step 4: Deploy the Worker**

```bash
cd worker
npx wrangler deploy
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put GUILD_PASSPHRASE
```

- [ ] **Step 5: Point the client at the deployed Worker**

Replace `<subdomain>` in `js/api.js` with the URL printed by `wrangler deploy`.

```bash
git add js/api.js && git commit -m "chore: point client at deployed worker" && git push
```

- [ ] **Step 6: End-to-end verification**

1. Open `https://revelation343.github.io/raid-roster/`
2. Confirm Coverage reads Tank 2 / Melee 8 / Ranged 9 / Healer 4 / Augvoker 0, Incomplete 1
3. Change a spec, Save, confirm the commit appears at
   `https://github.com/revelation343/raid-roster/commits/main/data/roster.json`
4. Open History, confirm the change is listed, press Restore, confirm the editor reverts
5. Open in a second browser, save from both, confirm the second gets the stale-reload path
6. Clear `localStorage`, enter a wrong passphrase, confirm the save is rejected

- [ ] **Step 7: Final commit**

```bash
git add -A && git commit -m "chore: deployment complete" && git push
```

---

## Self-Review

**Spec coverage:** §4 architecture → Tasks 10, 12. §5 data model → Tasks 5, 10.
§6 reference data → Tasks 2, 3, 4. §7 bug fixes → asserted in Tasks 6 (Devourer),
4 (`3% Damage` → Hunter, `Marksmanship`), 7 (2 min = 3). §8 interface → Tasks 8, 9, 11.
§9 saving/audit → Tasks 10, 12. §10 security → Task 12. §11 acceptance tests →
Tasks 6, 7 (parity, reconciliation), 3 (spec classification), 4 (spec-name closure),
13 step 6 (concurrency, validation). §12 deployment → Task 13.

**Placeholders:** none. `<subdomain>` in Task 10 is resolved in Task 13 step 5.

**Type consistency:** `computeAll` returns `{roles, classes, buffs, utility, tierTokens,
cooldowns, cooldownUnassigned, incomplete, totals}`; every consumer in Tasks 7, 9 uses
those exact names. `mainPairs`/`altPairs` are defined in Task 6 and reused in Task 7.
`validateRoster` returns `null` on success or a string, consistently in Tasks 12.
`roleFor(cls, spec)` signature is consistent across Tasks 3, 6.
