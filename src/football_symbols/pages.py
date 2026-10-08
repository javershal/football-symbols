"""Copy web/ into site/ and write one HTML entry page per route, each with its own Open Graph tags.

GitHub Pages can't rewrite URLs and unfurlers don't run JS, so week/N/, team/ABBR/, game/ID/ and standings/
are real files. Every page uses a relative <base>, so the site works under /football-symbols/
or at the root of a custom domain.
"""

import hashlib
import html
import json
import os
import shutil
from pathlib import Path
from urllib.parse import urlsplit

from . import config

WEB = Path(__file__).resolve().parents[2] / "web"
ASSETS = ["app.js", "app.css", "favicon.svg"]


def site_url() -> str:
    """Absolute URL of the site root, for og:url. Set SITE_URL in CI."""
    return os.environ.get("SITE_URL", "http://localhost:8000/").rstrip("/") + "/"


def routes(season: int, latest_week: int, records: dict[str, str], games: list[dict] = ()) -> list[dict]:
    teams = config.teams()["teams"]
    out = [dict(path="", title=f"Week {latest_week} · Scoreboard 2.0",
                description=f"Every {season} NFL drive as an emoji. Week {latest_week} scores.")]
    for w in range(1, 19):
        out.append(dict(path=f"week/{w}/", title=f"Week {w} · Scoreboard 2.0",
                        description=f"Every drive of every {season} Week {w} game, one emoji per drive."))
    out.append(dict(path="standings/", title="Standings · Scoreboard 2.0",
                    description=f"{season} NFL standings by division, with every game's drives."))
    out.append(dict(path="team/", title="Teams · Scoreboard 2.0",
                    description=f"Pick a team to see its {season} season drive by drive."))
    for t, info in teams.items():
        rec = f" ({records[t]})" if records.get(t) else ""
        out.append(dict(path=f"team/{t}/", title=f"{info['city']} {info['name']} · Scoreboard 2.0",
                        description=f"{info['name']} {season}{rec}: every drive, game by game."))
    for g in games:
        a, h = teams[g["away"]]["name"], teams[g["home"]]["name"]
        if g["final"]:
            title = f"{a} {g['aScore']}, {h} {g['hScore']} · Week {g['week']} · Scoreboard 2.0"
            desc = f"Every drive of {a} at {h}, Week {g['week']} {season}, play by play."
        else:
            title = f"{a} at {h} · Week {g['week']} · Scoreboard 2.0"
            desc = f"{a} at {h}, Week {g['week']} {season}. Drive charts post after the game."
        out.append(dict(path=f"game/{g['id']}/", title=title, description=desc))
    return out


def write_pages(site: Path, season: int) -> None:
    site.mkdir(parents=True, exist_ok=True)
    for name in ASSETS:
        shutil.copy2(WEB / name, site / name)
    v = {n: hashlib.sha1((WEB / n).read_bytes()).hexdigest()[:10] for n in ("app.js", "app.css")}
    tpl = (WEB / "index.html").read_text("utf-8")
    meta = json.loads((site / "data" / "meta.json").read_text("utf-8"))
    st = json.loads((site / "data" / str(season) / "standings.json").read_text("utf-8"))
    records = {t["team"]: f"{t['w']}-{t['l']}" + (f"-{t['t']}" if t["t"] else "")
               for d in st["divisions"] for t in d["teams"]}
    gdir = site / "data" / str(season) / "games"
    games = [json.loads(p.read_text("utf-8")) for p in sorted(gdir.glob("*.json"))]
    root = site_url()
    for r in routes(season, meta["latestWeek"], records, games):
        depth = r["path"].count("/")
        page = tpl
        for k, val in {"base": "../" * depth or "./", "title": r["title"], "description": r["description"],
                       "url": root + r["path"],
                       "v_css": v["app.css"], "v_js": v["app.js"]}.items():
            page = page.replace("{{" + k + "}}", html.escape(val, quote=True))
        dest = site / r["path"] / "index.html"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(page, "utf-8")
    (site / "404.html").write_text(
        (WEB / "404.html").read_text("utf-8").replace("{{root}}", urlsplit(root).path), "utf-8")
    (site / ".nojekyll").write_text("")
