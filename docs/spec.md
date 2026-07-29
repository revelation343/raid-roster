# Raid Roster — Design Spec

**Date:** 2026-07-29
**Status:** Awaiting review
**Replaces:** "Raid Roster Template MN WIP" Google Sheet (r3con), and Tim's copy
"Echoes of the Infinite Raid Roster - Midnight"

---

## 1. Problem

The current roster is a Google Sheet whose right-hand analytics panel is built from
118 `COUNTIF`/`COUNTIFS` formulas living directly in cells. The roster data occupies
columns A–J; every derived number (role counts, class counts, buff coverage, tier
tokens, utility, cooldown profiles) is a formula in a cell to the right of it.

This fails in two ways:

1. **It is destructible by normal use.** A paste over a cell replaces the formula with
   a literal value, permanently. The sheet ships with the warning *"Do not copy/paste
   from/to columns B - G: it breaks the logic"* — an admission that correctness depends
   on user restraint. Sheet protection prevents casual damage but also prevents repair,
   which is how the previous season's copy became unfixable.

2. **It is already wrong.** Three defects were found by reading the template's formulas
   directly (see §7). One of them — Devourer being classified into no raid role — means
   a player has been invisible to the tank and melee counts all season.

There is also no usable audit trail. Google Sheets version history exists but is not
attributable at field level and is impractical for answering "who changed Mortal's
off-spec, and when".

## 2. Goals

- Roster data that cannot be structurally broken by a user editing it
- Derived analytics that are computed, never stored, and therefore have nothing to protect
- A per-change audit trail with one-click restore
- No accounts, no signup, no login flow
- Reproduce the sheet's analytics faithfully, minus the three known bugs

## 3. Non-goals

Explicitly out of scope, decided 2026-07-29:

- Per-raid-night attendance / signup
- Saved per-boss compositions
- Loot tracking, attendance history, performance data
- Integration with Raider.IO, WarcraftLogs, or the Battle.net API
- Real user identity or authentication

## 4. Architecture

Static site on GitHub Pages, under the `revelation343` account. Roster stored as a
JSON file in the same repo. Writes go through a small Cloudflare Worker that commits
to the repo on the user's behalf.

```
Browser (GitHub Pages, static)
    |
    |  POST /save   { roster, actor, baseSha, passphrase }
    v
Cloudflare Worker  (holds GitHub token + guild passphrase)
    |
    |  PUT /repos/revelation343/<repo>/contents/data/roster.json
    v
GitHub repo  ->  commit history IS the audit log
    |
    |  GET /repos/.../commits  (public, unauthenticated)
    v
Browser History tab
```

**Why git as the store.** The audit trail is the entire point of the exercise, and git
commit history is a better audit log than anything worth building by hand: permanent,
diffable, human-readable, with an existing UI. Restore is reverting to a prior blob.
The data also stays a plain text file that can be repaired by hand — the precise
failure mode the sheet had.

**Concurrency.** The GitHub Contents API requires the caller to pass the blob SHA being
replaced. A stale SHA returns 409. The client then reloads and asks the user to redo
the edit. Two people saving at once can never silently clobber each other.

**No build step.** Vanilla HTML/CSS/JS. This is a table and a set of counters; a
framework and a build pipeline would be liabilities on a project that must still work
in three years with no maintenance.

## 5. Data model

### 5.1 `data/roster.json`

```json
{
  "version": 1,
  "title": "Echoes of the Infinite — Midnight",
  "players": [
    {
      "id": "silence",
      "name": "Silence",
      "main":  { "class": "Paladin", "spec": "Retribution", "offSpec": "Protection" },
      "alt":   { "class": "Warrior", "spec": "Fury",        "offSpec": "Protection" },
      "note":  "Fuck portals. I am the light.",
      "status": "locked"
    }
  ]
}
```

- `id` — stable slug, generated once from the name, never changes. Renaming a player
  preserves their identity in the audit log.
- `status` — exactly one of `locked` | `bench` | `out`. This replaces the sheet's two
  independent booleans (`Locked In`, `Bench`), which can both be `FALSE` at once and
  contradict each other.
- `alt` is optional and may be `null`. Individual spec fields may be `null` when a
  player has not chosen one.

### 5.2 `data/game-data.js`

All class/spec/role/buff/utility mappings, as plain editable tables. This is the file
that gets edited when Blizzard changes something — one place, not 118 formulas spread
across four tabs.

## 6. Reference data

Transcribed from the template's formulas, with the §7 fixes applied.

### 6.1 Classes and specs

| Class | Specs |
|---|---|
| Death Knight | Blood, Frost, Unholy |
| Demon Hunter | Havoc, Vengeance, Devourer |
| Druid | Balance, Feral, Guardian, Restoration |
| Evoker | Devastation, Preservation, Augmentation |
| Hunter | Beast Mastery, Marksmanship, Survival |
| Mage | Arcane, Fire, Frost |
| Monk | Brewmaster, Mistweaver, Windwalker |
| Paladin | Holy, Protection, Retribution |
| Priest | Discipline, Holy, Shadow |
| Rogue | Assassination, Outlaw, Subtlety |
| Shaman | Elemental, Enhancement, Restoration |
| Warlock | Affliction, Demonology, Destruction |
| Warrior | Arms, Fury, Protection |

### 6.2 Role, keyed by (class, spec)

The sheet expresses roles as spec-name lists with class disambiguation bolted on where
spec names collide (`Frost` is both Mage and Death Knight; `Holy` is both Paladin and
Priest; `Restoration` is both Druid and Shaman). Keying on the pair removes the special
cases entirely.

| Class | Tank | Healer | Melee DPS | Ranged DPS | Augvoker |
|---|---|---|---|---|---|
| Death Knight | Blood | — | Frost, Unholy | — | — |
| Demon Hunter | Vengeance | — | Havoc | **Devourer** | — |
| Druid | Guardian | Restoration | Feral | Balance | — |
| Evoker | — | Preservation | — | Devastation | Augmentation |
| Hunter | — | — | Survival | Beast Mastery, Marksmanship | — |
| Mage | — | — | — | Arcane, Fire, Frost | — |
| Monk | Brewmaster | Mistweaver | Windwalker | — | — |
| Paladin | Protection | Holy | Retribution | — | — |
| Priest | — | Discipline, Holy | — | Shadow | — |
| Rogue | — | — | Assassination, Outlaw, Subtlety | — | — |
| Shaman | — | Restoration | Enhancement | Elemental | — |
| Warlock | — | — | — | Affliction, Demonology, Destruction | — |
| Warrior | Protection | — | Arms, Fury | — | — |

Every (class, spec) pair in §6.1 appears exactly once. A startup assertion enforces
this — an unclassified spec fails loudly instead of silently vanishing from the counts.

### 6.3 Major buffs / debuffs

Source is a class unless a spec is named.

| Buff | Provided by |
|---|---|
| Intellect | Mage |
| Attack Power | Warrior |
| Stamina | Priest |
| 3% DR (Devo Aura) | Paladin |
| 5% Physical | Monk |
| 3% Magic | Demon Hunter |
| 3% Versatility | Druid |
| 3% Damage | Hunter |
| Bloodlust | Mage, Shaman, Evoker |
| Combat Res | Druid, Warlock, Death Knight, Paladin |
| Burst Move Speed | Druid, Shaman |
| Lock Stuff (HS, Gate, Curse) | Warlock |
| Mass Dispel | Priest; spec Mistweaver |
| Innervate | Druid |
| Death Grip/AMZ | Death Knight |
| Blessing of Protection | Paladin |
| Rallying Cry | Warrior |
| Darkness | Demon Hunter |
| Immunities | Paladin, Mage, Hunter |
| Skyfury | Shaman |
| Boss DR | Rogue |
| Dragons | Evoker |
| Execute Damage | Warrior, Paladin, Priest, Hunter; specs Fire, Assassination |
| Attack Speed Reduction | Rogue, Death Knight, Warlock |
| Cast Speed Reduction | Rogue, Warlock |

Bloodlust deliberately excludes Hunter pets — this matches the template and was
confirmed against the live roster (Main = 8 = 5 Mages + 3 Shamans).

### 6.4 Utility

| Utility | Provided by |
|---|---|
| Knock Up/Back | Evoker, Monk, Druid, Shaman, Hunter, Mage |
| Mortal Strike | Rogue; specs Arms, Havoc |
| Soothe | Evoker, Monk, Druid, Hunter |
| Purge | Priest, Mage, Shaman, Hunter |
| Power Infusion | Priest |
| Extra Dam to Shields | Evoker, Warrior |
| Cheat Death | Rogue; specs Augmentation, Fire, Vengeance, Blood; Priest + Holy |
| Blessing of Spellwarding | Paladin + Protection |

### 6.5 Tier tokens

| Token | Classes |
|---|---|
| Dreadful (Cloth) | Priest, Mage, Warlock |
| Mystic (Leather) | Druid, Monk, Rogue, Demon Hunter |
| Venerated (Mail) | Evoker, Hunter, Shaman |
| Zenith (Plate) | Paladin, Warrior, Death Knight |

### 6.6 Cooldown profiles

Per the template's own note, sourced from Lorrgs.io data and covering DPS specs only.

| Profile | Specs |
|---|---|
| 1 and 1.5 min | Fury, Enhancement, Retribution |
| 2 min | Survival, Assassination, Subtlety, Devastation, Affliction, Shadow, Fire, **Marksmanship**, Augmentation, Feral, Havoc, Windwalker, Demonology, Destruction, Beast Mastery |
| 3 min | Balance, Unholy |

**Known gap, carried forward deliberately:** Arcane, Frost (Mage), Elemental, and
Devourer have no cooldown profile in the source template. These are left unassigned
rather than invented. The UI shows an "Unassigned" count so the gap is visible instead
of silently absorbed. Filling it in is a data edit, not a code change.

## 7. Bugs fixed

Found by extracting formulas from `xl/worksheets/sheet1.xml` of the template.

**7.1 — Devourer classified into no role.** `L2` (Tank) covers Protection, Brewmaster,
Blood, Vengeance, Guardian. `L3` (Melee) covers Havoc but not Devourer. Devourer is new
in Midnight, present in the dropdowns, and absent from every role bucket.

Verified against the live roster: role counts summed to 22 against 24 locked-in players.
The two uncounted were Mortal (Demon Hunter / Devourer) and Emilios (Hunter, no main
spec entered). All 24 were assigned by hand and every bucket reconciled exactly.

*Fix:* Devourer → Ranged DPS, per [Icy Veins](https://www.icy-veins.com/wow/devourer-demon-hunter-pve-dps-guide)
and [Wowhead](https://www.wowhead.com/guide/classes/demon-hunter/devourer/overview-pve-dps),
both of which describe it as a mid-range DPS spec with Intellect as its primary stat
_[verified 2026-07-29]_. Not melee — it pairs with Vengeance off-specs in the roster,
which is misleading.

**7.2 — `Q9` counts the wrong class.** Row 9 is the "3% Damage" buff. `P9` correctly
counts Hunter mains; `Q9` is `countif(altclass,"Druid")`. Every sibling row uses its
own class in both columns. The Alt figure for that buff has been reporting the Druid
alt count.

*Fix:* `Hunter` in both columns.

**7.3 — `T22` searches for `"Marksman"`.** The spec string is `Marksmanship`, which the
same sheet uses correctly in `L4`. `COUNTIF` matches whole-cell, so the term never
matches and Marksmanship hunters are absent from the 2-minute cooldown profile.
Confirmed on the live roster: profile reads 2, should read 3 (Radoodoo).

*Fix:* `Marksmanship`.

**Checked and found not to be a bug:** `T23` uses lowercase `"unholy"`. `COUNTIF` is
case-insensitive, so it matches correctly. No change.

**Noted, not carried forward:** `Q12` (Combat Res / Alt) adds the main-class counts into
the alt column and omits the bench filter, unlike every other `Q` formula. It is
inflated by the entire main roster. The rebuild computes alt coverage the same way as
every other row, so this does not survive by construction — but it means the new
Combat Res "Offspec/Alt" number will be lower than the sheet's, correctly.

## 8. Interface

Single page, three tabs.

**Roster.** One row per player. Name is free text; class is a dropdown; spec dropdowns
are populated from the selected class. Status is a three-way toggle. Note is free text.
Add/remove row. Everything recomputes on change.

**Coverage.** The six derived blocks, laid out like the sheet so it reads familiar:
Raid Roles, Classes, Major Buffs/Debuffs, Tier Tokens, Utility, Cooldown Profiles.
Each shows Main and Offspec/Alt counts. Zero-coverage rows are highlighted — the point
of the panel is spotting what the raid is missing.

Bench and out players are excluded from Main counts, matching the sheet's
`bench,"FALSE"` filter.

**History.** Reverse-chronological list of commits, rendered as plain English
("Bwinks changed Mortal's off-spec from Vengeance to Devourer"), each with a
**Restore this version** button.

Incomplete players (no main spec, like Emilios) are flagged inline on the Roster tab
rather than silently dropped from counts.

## 9. Saving and audit

On save the client sends the full roster, the actor name, and the base SHA. The Worker
validates and commits.

- Commit author name — the self-reported actor
- Commit subject — `<actor>: <one-line summary>`
- Commit body — field-level before/after lines

Actor is chosen from a dropdown of current roster names plus a free-text option,
remembered in `localStorage`. Self-reported and therefore spoofable — accepted
deliberately in exchange for no signup (decided 2026-07-29). The value is knowing *what*
changed and being able to undo it; the *who* is a convenience.

## 10. Security

The save endpoint is a public URL and would otherwise let anyone rewrite the roster.

- **Shared guild passphrase**, held in the Worker, entered once, stored in
  `localStorage`. One door code for the whole guild, not per-user credentials.
- **Schema validation in the Worker.** Rejects anything that is not a structurally
  valid roster — classes and specs must exist in the reference tables, status must be
  one of the three values, arrays bounded. A malformed or malicious payload cannot be
  committed.
- **Rate limit** per IP.
- The GitHub token lives only in Worker secrets, never in the page.

**The repo is public** — required for free Pages hosting and for the unauthenticated
commits API the History tab reads. Roster contents, including the notes column, are
public. Already effectively true of a link-shared Google Sheet, but stated so it is a
decision rather than a surprise.

## 11. Acceptance tests

1. **Parity.** Load the live roster (24 locked, 1 benched) as a fixture. Every derived
   number must match the sheet's, except the three §7 fixes and the §7 `Q12` note, each
   of which has an explicit expected-difference assertion. This is the primary test —
   it is what proves the reference tables were transcribed correctly.
2. **Role totals reconcile.** Sum of role counts + incomplete players = locked-in count.
   This is the assertion that would have caught the Devourer bug.
3. **Every spec is classified.** Each (class, spec) pair in §6.1 resolves to exactly one
   role. Fails at startup otherwise.
4. **Spec strings are closed.** Every spec named anywhere in §6.2–6.6 exists in §6.1.
   This is what makes a `Marksman`/`Marksmanship` typo impossible.
5. **Concurrency.** A save with a stale SHA is rejected and does not modify the file.
6. **Validation.** Payloads with unknown classes, unknown specs, or bad status are
   rejected by the Worker.

## 12. Deployment

- Repo `revelation343/raid-roster`, public, Pages from `main`
- Cloudflare Worker, free tier; secrets: GitHub token, guild passphrase
- `gh` CLI is authenticated as `revelation343` on this machine

## 13. Open items

None blocking. The cooldown-profile gap in §6.6 is a data question for the guild, not a
build dependency — the site ships with those specs shown as Unassigned.
