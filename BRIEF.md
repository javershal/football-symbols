# Possession Strips — Website Build Brief

Supersedes the earlier image-pipeline handoff. The goal is now a static website on GitHub Pages; images become share assets the site generates. Data-derivation rules and golden tests carry over unchanged (below).

## What we're building

A mobile-first static site, repo `football-symbols`, served at `<user>.github.io/football-symbols`. A scheduled GitHub Action pulls nflverse data, derives possessions, writes JSON + share images, and commits. The front end only renders JSON — no server, no database.

Three views, all working on phone (375px) and desktop:

1. **Scores (weekly)** — week selector (1–18), game cards with both teams' strips and scores, per-game "Copy" and per-week "Copy week", per-card "Save image". Games not yet final show Upcoming (kickoff in PT) or In progress. `prototype_week_view.html` is the reference: match its look and behavior.
2. **Standings** — one ledger per division: 2x2 team blocks, real W-L(-T) records, one row per game (week, opponent, result, strip), bye rows included, teams sorted by record then point differential. No tiebreaker scenarios.
3. **Team** — `/team/ABBR`: (a) the team's own drives, game by game; (b) each game showing the team's strip alongside the opponent's.

Scope: 2026 season only. (Maybe later: an "interesting seasons" section — design data paths so a season can be added, e.g. `data/2026/...`.)

## Design: "Turf" (locked)

- Colors: background #2F5D3A, cards #2A5434 with 1.5px dashed #5E8A69 border, text #F4F1E8, secondary #B9CDBE, rules #5E8A69, mustard accent #E3B341 (headline offset text-shadow, legend top rule, primary button).
- Fonts (Google Fonts): Bricolage Grotesque 800 for headlines, team stamps, scores; Atkinson Hyperlegible Mono for everything else.
- Team stamps: team primary color, white text, 3px offset box-shadow in the team's secondary color. Colors are in the prototype's `TC` table.
- Strips are horizontal only, never wrap. **Auto-fit:** both strips in a card shrink together until the longer one fits (see `fit()` in the prototype). Longest 2026 strip so far is 15 drives; must fit at 375px with no horizontal scroll.
- Emoji use the system font stack (`Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji`). Server-rendered share PNGs use Noto Color Emoji.
- Legend visible on every view. Footer credits nflverse (CC-BY-4.0) and shows "Updated <timestamp>".

## Legend (locked — keep in one config file)

| Outcome | Emoji | `fixed_drive_result` |
|---|---|---|
| Touchdown | 🟩 | Touchdown |
| Field goal | 🟢 | Field goal |
| Punt | ⬜ | Punt |
| Missed FG | ⭕ | Missed field goal |
| Interception or fumble | 🔺 | Turnover |
| Turnover on downs | 🔻 | Turnover on downs |
| Turnover returned for TD | ♦️ (U+2666 U+FE0F) | Opp touchdown |
| Safety | 🟪 | Safety |
| End of half | ⏸️ | End of half, drive ends Q1–Q3 |
| End of game | ⏹️ | End of half, drive ends Q4/OT |

Pipe ( | ) separates halves; OT gets a second pipe. No three-and-out symbol. A defensive TD appears only in the row of the team that lost the ball, so rows needn't sum to the score. Display the Rams as LAR (nflverse uses LA).

## Copy-to-clipboard format

Winner first in the header line, then away row, then home row, halves joined with ` | `:

```
Browns 27, Steelers 24:
PIT 🟩🔺⬜⭕🟢 | ⬜⬜⬜🟩⬜🟩🔺
CLE ⬜⬜🟩🟩🟩⏸️ | ⬜🔺🔺🟢⬜🟢⏹️
```

"Copy week" = `Week N` + blank line + each final game in that format. Must use the locked legend exactly, same as the images. Fall back to `execCommand('copy')` if the Clipboard API is unavailable. Add a test that a single game stays under Bluesky's 300-grapheme limit.

## Data

- Play-by-play: `https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_2026.csv.gz` (CC-BY-4.0; credit nflverse).
- Schedule (for upcoming games, kickoff times, byes): `https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv`. `gametime` is US Eastern; display PT. Filter `season==2026`, `game_type=='REG'`.
- A game is "final" once it appears in pbp. `prototype_data.py` is the working derivation; port it into the package.

Derivation rules (tested — the prototype matched hand-built charts):

1. Drop plays with no `posteam` or no `fixed_drive_result`.
2. Group by `game_id` + `fixed_drive`, in order.
3. Assign each drive to the most common `posteam` among its non-kickoff plays (not the first play's).
4. A kickoff with `fumble_lost == 1` inserts a separate receiving-team possession with result Turnover (🔺) just before the drive.
5. End of half → ⏹️ if the drive's last play is Q4 or later, else ⏸️.
6. Split halves by the drive's starting quarter: Q1–Q2, Q3–Q4, OT (Q5+) as its own segment.
7. Scores from `home_score`/`away_score`; records from those (ties count as T).

## Golden tests (must pass exactly)

| Game | Team | Expected |
|---|---|---|
| 2026 W1, WAS at PHI | PHI | ⬜⬜🟩⬜🟩⬜ \| ⬜⬜⬜🟢🟩⏹️ |
| 2026 W1, WAS at PHI | WAS | 🟢⬜⬜⬜⬜🟩⏸️ \| ⬜⭕⬜🟩🟩 |
| 2026 W2, PHI at TEN | PHI | 🔺🟩🟩 \| ⬜🟢⬜🔺🟩 |
| 2026 W3, PHI at CHI | PHI | ⬜🔺🔺🟩 \| ⬜⬜⬜🔺🔻 |
| 2026 W3, PHI at CHI | CHI | 🟩⬜🔻🟢 \| 🟢🟩⬜🟩⏹️ |
| 2026 W4, PIT at CLE | PIT | 🟩🔺⬜⭕🟢 \| ⬜⬜⬜🟩⬜🟩🔺 |
| 2026 W4, PIT at CLE | CLE | ⬜⬜🟩🟩🟩⏸️ \| ⬜🔺🔺🟢⬜🟢⏹️ |

Also: the W3 CAR at CLE lost kickoff fumble is handled (rule 4), and the three Weeks 1–2 overtime games get a second pipe.

## Build & deploy

- Python package builds `site/data/2026/weeks/<n>.json`, `teams/<ABBR>.json`, `standings.json`, plus `meta.json` (updated-at, latest week). Front end is static HTML/CSS/JS — keep it framework-light; no build step required unless clearly worth it.
- Share images: Playwright + Chromium renders per-game card PNGs, a weekly board, and per-division ledgers, plus Open Graph preview images (1200×630) for each week, team, and standings page so links unfurl on Bluesky/Reddit. Pages can't render these on the fly, so they are pre-built.
- Client-side "Save image" per card: render the card to PNG in the browser (e.g. html-to-image), or link to the pre-built PNG — pick whichever handles emoji reliably on iOS Safari.
- GitHub Action: cron nightly during the season (plus extra runs Thu/Sun/Mon nights), and `workflow_dispatch`. Build → run golden tests → commit only if data changed → deploy to Pages. Never publish if tests fail. Alert on failure (GitHub's default failure email is fine to start).
- Known gotchas: GitHub disables scheduled workflows in public repos after 60 days without repo activity, and cron runs can start late. nflverse data lags games by hours.

## Routing & accessibility

- Hash or path routes: `#/week/N`, `#/standings`, `#/team/ABBR`. Use paths that would still work with a custom domain later.
- Each strip carries an accessible label (e.g. "PIT drives. First half: touchdown, interception or fumble, …"), as in the prototype.
- Tap targets ≥ 36px; works with no horizontal page scroll at 375px.

## Out of scope for v1

Automated Bluesky posting (Jacob posts manually), tiebreakers, live in-game updates, past seasons.

## Done when

- [ ] All three views work at 375px and desktop, Turf design, no horizontal scroll
- [ ] Golden tests pass in CI; failed tests block deploy
- [ ] Copy and Copy week produce the exact format above
- [ ] Upcoming / In progress placeholders show for non-final games
- [ ] Nightly Action updates data and redeploys unattended
- [ ] OG preview images unfurl correctly for week, team, and standings links
- [ ] Legend changes by editing one config file
