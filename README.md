# Possession Strips

Every 2026 NFL drive as an emoji, one strip per team per game. Static site on GitHub Pages; a scheduled
GitHub Action pulls [nflverse](https://github.com/nflverse/nflverse-data) data (CC-BY-4.0), derives
possessions, runs the golden tests, commits `site/data/`, and deploys.

```sh
uv sync
uv run football-symbols fetch   # nflverse pbp + schedule -> .cache/
uv run pytest                   # golden tests (need .cache/)
uv run football-symbols build   # site/data JSON + site/ pages from web/
uv run football-symbols serve   # http://localhost:8000/
```

- `src/football_symbols/config/legend.json` — the legend. Change emoji or labels here only.
- `src/football_symbols/config/teams.json` — names, colors, divisions, LA→LAR.
- `src/football_symbols/derive.py` — possession rules (see BRIEF.md).
- `web/` — front end source (plain HTML/CSS/JS). `site/` is build output except `site/data/`.
