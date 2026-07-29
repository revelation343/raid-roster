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

## Save endpoint

The site is read-only until the Cloudflare Worker in [`worker/`](worker) is deployed:

```bash
cd worker
npx wrangler deploy
npx wrangler secret put GITHUB_TOKEN      # fine-grained, this repo only, Contents: RW
npx wrangler secret put GUILD_PASSPHRASE
```

Then replace `PLACEHOLDER` in `js/api.js` with the deployed subdomain.
