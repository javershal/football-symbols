"""Turn derived games into the site's JSON: site/data/<season>/{weeks/<n>,teams/<ABBR>,standings}.json."""

import json
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from . import config, derive, share
from .derive import Game

ET = ZoneInfo("America/New_York")
WEEKS = range(1, 19)


def kickoff_utc(g: Game) -> str:
    t = datetime.fromisoformat(f"{g.day}T{g.time}").replace(tzinfo=ET)
    return t.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def game_json(g: Game) -> dict:
    d = dict(id=g.id, week=g.week, day=g.day, kickoff=kickoff_utc(g), away=g.away, home=g.home, final=g.final)
    if g.final:
        d.update(aScore=g.a_score, hScore=g.h_score, aStrip=g.a_strip, hStrip=g.h_strip,
                 copy=share.game_text(g))
    return d


def team_rows(team: str, games: list[Game]) -> list[dict]:
    """One row per week 1-18 from `team`'s side, byes included."""
    by_week = {g.week: g for g in games if team in (g.away, g.home)}
    rows = []
    for w in WEEKS:
        g = by_week.get(w)
        if g is None:
            rows.append(dict(week=w, bye=True))
            continue
        home = g.home == team
        r = dict(week=w, id=g.id, opp=g.away if home else g.home, home=home,
                 day=g.day, kickoff=kickoff_utc(g), final=g.final)
        if g.final:
            pf, pa = (g.h_score, g.a_score) if home else (g.a_score, g.h_score)
            r.update(pf=pf, pa=pa, result="W" if pf > pa else "L" if pf < pa else "T",
                     strip=g.h_strip if home else g.a_strip,
                     oppStrip=g.a_strip if home else g.h_strip, copy=share.game_text(g))
        rows.append(r)
    return rows


def record(rows: list[dict]) -> dict:
    fin = [r for r in rows if r.get("final")]
    rec = {k: sum(r["result"] == k[0].upper() for r in fin) for k in ("w", "l", "t")}
    rec.update(pf=sum(r["pf"] for r in fin), pa=sum(r["pa"] for r in fin))
    return rec


def standings_key(t: dict):
    gp = t["w"] + t["l"] + t["t"]
    pct = (t["w"] + 0.5 * t["t"]) / gp if gp else 0.0
    return (-pct, -(t["pf"] - t["pa"]), t["team"])


def build_data(games: list[Game], season: int) -> dict[str, object]:
    """Relative path (under data/) -> JSON payload."""
    out: dict[str, object] = {}
    for w in WEEKS:
        out[f"{season}/weeks/{w}.json"] = dict(
            season=season, week=w, games=[game_json(g) for g in games if g.week == w])
    divisions = []
    for div, members in config.teams()["divisions"].items():
        block = []
        for team in members:
            rows = team_rows(team, games)
            rec = record(rows)
            out[f"{season}/teams/{team}.json"] = dict(season=season, team=team, division=div,
                                                    **rec, games=rows)
            slim = [{k: v for k, v in r.items() if k not in ("oppStrip", "copy")} for r in rows]
            block.append(dict(team=team, **rec, games=slim))
        divisions.append(dict(name=div, teams=sorted(block, key=standings_key)))
    out[f"{season}/standings.json"] = dict(season=season, divisions=divisions)
    out["legend.json"] = config.legend()
    out["teams.json"] = config.teams()
    return out


def latest_week(games: list[Game]) -> int:
    return max((g.week for g in games if g.final), default=1)


def dumps(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n"


def write_data(data_dir: Path, payloads: dict[str, object], meta: dict) -> list[str]:
    """Write payloads that changed. meta.json (with `updated`) is rewritten only when
    something else changed, so a no-op build leaves the tree clean for git."""
    changed = []
    for rel, obj in payloads.items():
        p = data_dir / rel
        text = dumps(obj)
        if not p.exists() or p.read_text("utf-8") != text:
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(text, "utf-8")
            changed.append(rel)
    mp = data_dir / "meta.json"
    old = json.loads(mp.read_text("utf-8")) if mp.exists() else {}
    if changed or {k: v for k, v in old.items() if k != "updated"} != meta:
        updated = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        mp.write_text(dumps({"updated": updated, **meta}), "utf-8")
        changed.append("meta.json")
    return changed


def build(cache: Path, site: Path, season: int) -> list[str]:
    pbp = derive.read_pbp(cache / "pbp.csv.gz")
    sched = derive.read_schedule(cache / "games.csv", season)
    games = derive.games(pbp, sched)
    meta = dict(season=season, seasons=[season], latestWeek=latest_week(games))
    return write_data(site / "data", build_data(games, season), meta)
