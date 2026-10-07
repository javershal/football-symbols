# Possession Strips (football-symbols)

A static site showing every 2026 NFL drive as one emoji per possession. It is live at
https://javershal.github.io/football-symbols/ (repo `javershal/football-symbols`, public).
A scheduled GitHub Action fetches nflverse data, derives possessions, runs the golden tests,
commits `site/data/` and deploys to Pages. There is no server and no database.

`BRIEF.md` is the original spec. **The site deliberately differs from it in places. See
"Deviations from BRIEF.md" below; this file wins where the two disagree.**
`prototype_data.py` and `prototype_week_view.html` are kept as reference only.

## Commands (always via uv)

```sh
uv sync
uv run football-symbols fetch   # nflverse pbp + schedule -> .cache/
uv run pytest                   # golden + build tests; reads .cache/ and FAILS (never skips) if it's missing
uv run football-symbols build   # site/data JSON, then copies web/ -> site/ and writes route pages
uv run football-symbols serve   # http://localhost:8000/
uv run ruff check src tests     # CI runs this too
```

Set `SITE_URL` (CI uses the configure-pages `base_url`) to get correct `og:url` values and the 404 home link.

## Layout

- `src/football_symbols/config/legend.json` is **the only place the legend lives**. Python derivation,
  copy text and the site all read it, and the build copies it to `site/data/legend.json`.
- `src/football_symbols/config/teams.json` holds names, cities, colors, divisions and the alias `LA` → `LAR`.
- `derive.py` is a faithful port of the prototype and matches it on all 272 games. Keep the CSV row order:
  `play_id` is *not* monotonic within some games, and the golden tests depend on the file order.
- `share.py` builds the copy-to-clipboard text. It is generated in Python and stored as `copy` on each
  final game in the JSON, and the front end uses it verbatim. That keeps the format testable in pytest.
- `build.py` writes `site/data/2026/{weeks/<n>,teams/<ABBR>,standings}.json`, `meta.json`,
  `legend.json` and `teams.json`. It only writes files that changed. `meta.updated` changes **only when
  data changed**, so a no-op nightly run leaves git clean and makes no commit.
- `pages.py` copies `web/` into `site/` and writes one `index.html` per route (`week/N/`, `team/ABBR/`,
  `team/`, `standings/`), each with its own title and description. Every page uses a relative
  `<base href>`, so the site works under `/football-symbols/` or on a custom domain.
- `web/` is the front-end source: plain HTML, CSS and JS with no framework and no bundler.
  `site/` is build output and is gitignored, **except `site/data/`, which is committed by the Action**.
- `.github/workflows/update.yml` runs on cron (Sep–Jan only), `workflow_dispatch`, and pushes to main.
  Steps: lint → fetch → pytest → build → commit data if changed → deploy. If the tests fail, nothing
  is committed or deployed and GitHub's failure email is the alert.

## Front-end conventions

- Routes are paths, not hashes. Old `#/week/N` links are rewritten to the canonical path
  (`#/team/la` → `team/LAR/`). Internal links are relative `<a href>`s that the router intercepts.
- `fit()` shrinks every strip inside a `[data-fit]` group together until the longest one fits.
  Groups: a Scores card, a Standings team block, the Team "Our drives" ledger, a Team matchup card.
- Tap targets are ≥36px. Where the visual must be smaller (the tag-sized Copy button, team stamps),
  an `::after` pseudo-element enlarges the hit area.
- Check every change at 375px: the page must have no horizontal scroll and strips must not overflow.
  The longest strips so far are 15 drives (NO at DET W1, MIN at TB W3).
- Turf design tokens are in `:root` in `web/app.css`. The design is locked per the brief.

## Deviations from BRIEF.md (decided with Jacob, Oct 2026)

- **No "Save image" button and no client-side or per-card PNGs.** Share images (game cards, weekly
  board, division ledgers) are dropped from v1. Social-media images may come later as a separate
  screenshot pipeline.
- **No Open Graph preview images yet.** The `og:image` tags were removed. Pages still carry
  `og:title`, `og:description` and `og:url`, with `twitter:card=summary`. These are deferred, not cancelled.
- **No "Copy week".** Copy is single-game only. On Scores and Team matchup cards, the **Copy button
  replaces the "Final" tag** at the tag's size, with a 36px hit area. The copy format itself matches the brief exactly.
- **Upcoming games show the date only**, taken from the schedule's `gameday` (no kickoff time and no timezone
  math). The UTC `kickoff` field is used only to decide Upcoming vs In progress.
- **Scores come from pbp `home_score`/`away_score`**, not the schedule. A test asserts the two agree.
- **Standings:** 2×2 team blocks on desktop and one column on phones. Each block shows the record and an
  unlabeled point differential (for example `+20`, explained only by a hover tooltip; Jacob chose to keep
  it that way). There is a row of division jump buttons at the top.
- **Team page:** a toggle with **"Vs opponent" first and default** (cards with the team's strip above the
  opponent's, plus Copy) and "Our drives" second (one line per game: week, opponent, result, strip,
  the same row layout as Standings). `team/` is an index of all 32 teams by division. Team stamps link
  to team pages everywhere.
- The footer adds a "Source on GitHub" link, inviting people to fork it.

## Open items / known caveats

- OG preview images and the social screenshot pipeline (see above).
- Copy has not been tested on a real iPhone yet. It falls back to `execCommand('copy')`.
- On phones, Standings strips can get as small as ~7.5px in blocks that include a 15-drive game. A two-line
  row layout would fix that but would double the page length; that was not chosen.
- The workflow's actions trigger Node 20 deprecation warnings. Bump checkout, setup-uv, configure-pages,
  upload-pages-artifact and deploy-pages once their current major versions are confirmed.
  `ubuntu-latest` moves to Ubuntu 26 on 2026-10-19.
- GitHub disables scheduled workflows after 60 days without repo activity, which will likely happen in
  the offseason. Re-enable it in the Actions tab each September (or add a keepalive). Cron runs can
  start late, and nflverse data arrives hours after games end.
- Scope is the 2026 regular season only. Data paths are keyed by season (`data/2026/...`, and `meta.seasons`)
  so that a past "interesting season" can be added later.
