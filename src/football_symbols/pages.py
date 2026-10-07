"""Copy web/ into site/ and write one HTML entry page per route, each with its own Open Graph tags.

GitHub Pages can't rewrite URLs and unfurlers don't run JS, so week/N/, team/ABBR/ and standings/
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
    """Absolute URL of the site root (og:image must be absolute). Set SITE_URL in CI."""
    return os.environ.get("SITE_URL", "http://localhost:8000/").rstrip("/") + "/"


def routes(season: int, latest_week: int, records: dict[str, str]) -> list[dict]:
    teams = config.teams()["teams"]
    out = [dict(path="", title=f"Week {latest_week} · Possession Strips",
                description=f"Every {season} NFL drive as an emoji. Week {latest_week} scores.",
                og=f"img/{season}/og/week-{latest_week}.png")]
    for w in range(1, 19):
        out.append(dict(path=f"week/{w}/", title=f"Week {w} · Possession Strips",
                        description=f"Every drive of every {season} Week {w} game, one emoji per possession.",
                        og=f"img/{season}/og/week-{w}.png"))
    out.append(dict(path="standings/", title="Standings · Possession Strips",
                    description=f"{season} NFL standings by division, with every game's drives.",
                    og=f"img/{season}/og/standings.png"))
    out.append(dict(path="team/", title="Teams · Possession Strips",
                    description=f"Pick a team to see its {season} season drive by drive.",
                    og=f"img/{season}/og/standings.png"))
    for t, info in teams.items():
        rec = f" ({records[t]})" if records.get(t) else ""
        out.append(dict(path=f"team/{t}/", title=f"{info['city']} {info['name']} · Possession Strips",
                        description=f"{info['name']} {season}{rec}: every drive, game by game.",
                        og=f"img/{season}/og/team-{t}.png"))
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
    root = site_url()
    for r in routes(season, meta["latestWeek"], records):
        depth = r["path"].count("/")
        page = tpl
        for k, val in {"base": "../" * depth or "./", "title": r["title"], "description": r["description"],
                       "url": root + r["path"], "og_image": root + r["og"],
                       "v_css": v["app.css"], "v_js": v["app.js"]}.items():
            page = page.replace("{{" + k + "}}", html.escape(val, quote=True))
        dest = site / r["path"] / "index.html"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(page, "utf-8")
    (site / "404.html").write_text(
        (WEB / "404.html").read_text("utf-8").replace("{{root}}", urlsplit(root).path), "utf-8")
    (site / ".nojekyll").write_text("")
