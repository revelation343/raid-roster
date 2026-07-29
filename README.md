# Raid Roster

Replaces a Google Sheet whose analytics lived in cell formulas and broke whenever
somebody pasted over one.

Here the roster is a plain JSON file and **every derived number is computed at render
time**. There are no stored formulas, so there is nothing to overwrite and nothing to
protect. Worst case, somebody sets a wrong value in one field and you revert it in one
click.

- **Roster** — pick your class and spec for main and alt. Dropdowns are dependent, so
  an impossible combination cannot be entered.
- **Coverage** — raid roles, class spread, buff and debuff coverage, tier tokens,
  utility, cooldown profiles. Recomputed on every keystroke.
- **History** — every change is a git commit with a plain-English message and a
  one-click restore.

## Verification

`npm test` — 44 tests. The important one is parity: the derived numbers are asserted
against the original sheet's own values using the live 24-player roster.

Three of them deliberately disagree, because the sheet was wrong:

| | Sheet | Here | Why |
|---|---|---|---|
| Ranged DPS | 8 | 9 | Devourer was classified into no role at all |
| 3% Damage (alt) | Druid count | Hunter count | `Q9` counted the wrong class |
| 2 min CD profile | 2 | 3 | searched for `Marksman`, spec is `Marksmanship` |

The Devourer bug meant role counts summed to 22 against 24 locked-in players. A test now
asserts roles + incomplete = locked-in, so that can't recur silently.

See [`docs/spec.md`](docs/spec.md) for the full reference tables and
[`docs/plan.md`](docs/plan.md) for the build.

## Saving

Live at **https://revelation343.github.io/raid-roster/**

Open the link, put your name in the "Signing as" box once, and edit your card. There
is no sign-up, no password and no Save button — every change writes itself about a
second after you stop fiddling, and the plate flashes gold when it lands.

Two people editing at once is fine. Edits are scoped to a single player, so if somebody
commits while you are typing, your change is merged onto theirs and retried. Neither of
you loses anything.

Nothing in the interface is destructive. Removing one player takes an inline
confirmation and stays in the history forever; there is no way to wipe the board.

### Operating it

The save endpoint is a Cloudflare Worker (`worker/`) holding a GitHub token scoped to
this repository alone. It accepts only payloads that are structurally valid rosters, so
it cannot be used to write arbitrary content, and it rate-limits bursts.

To rotate the token, mint a new fine-grained one (this repo only, Contents: Read and
write) and:

```bash
cd worker && npx wrangler secret put GITHUB_TOKEN
```

To clear the roster for a new tier:

```bash
gh api -X PUT repos/revelation343/raid-roster/contents/data/roster.json   -f message="new tier — roster cleared"   -f content="$(printf '{"version":1,"title":"Raid Roster","players":[]}' | base64 -w0)"   -f sha="$(gh api repos/revelation343/raid-roster/contents/data/roster.json --jq .sha)"
```
