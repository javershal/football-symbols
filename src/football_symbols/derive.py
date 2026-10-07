"""Possession derivation, ported from prototype_data.py. See BRIEF.md "Derivation rules"."""

from dataclasses import dataclass

import pandas as pd

from . import config

PBP_COLUMNS = [
    "game_id", "week", "home_team", "away_team", "home_score", "away_score",
    "fixed_drive", "fixed_drive_result", "posteam", "qtr", "play_type", "fumble_lost",
]

Strip = list[list[str]]  # [first half, second half, (OT)] -> emoji per drive


def read_pbp(path) -> pd.DataFrame:
    return pd.read_csv(path, low_memory=False, usecols=PBP_COLUMNS)


def read_schedule(path, season: int) -> pd.DataFrame:
    s = pd.read_csv(path, low_memory=False)
    return s[(s.season == season) & (s.game_type == "REG")]


def drives(pbp: pd.DataFrame) -> pd.DataFrame:
    """One row per possession: game_id, fd (order key), team (nflverse abbr), res, q0, q1, s."""
    dd = pbp.dropna(subset=["posteam", "fixed_drive_result"])  # rule 1
    rows = []
    for (g, fd), x in dd.groupby(["game_id", "fixed_drive"], sort=True):  # rule 2
        nk = x[x.play_type != "kickoff"]
        team = nk.posteam.mode()[0] if len(nk) else x.posteam.iloc[0]  # rule 3
        k = x[(x.play_type == "kickoff") & (x.fumble_lost == 1)]
        if len(k):  # rule 4: lost kickoff fumble is its own receiving-team possession
            q = k.qtr.iloc[0]
            rows.append(dict(game_id=g, fd=fd - 0.5, team=k.posteam.iloc[0], res="Turnover", q0=q, q1=q))
        rows.append(dict(game_id=g, fd=fd, team=team, res=x.fixed_drive_result.iloc[0],
                         q0=x.qtr.iloc[0], q1=x.qtr.iloc[-1]))
    dr = pd.DataFrame(rows, columns=["game_id", "fd", "team", "res", "q0", "q1"])
    dr = dr.sort_values(["game_id", "fd"]).reset_index(drop=True)
    emoji = config.result_emoji()
    half, end = config.end_of_half_emoji()
    dr["s"] = [(end if r.q1 >= 4 else half) if r.res == "End of half" else emoji[r.res]  # rule 5
               for r in dr.itertuples()]
    return dr


def strip(dr: pd.DataFrame, game_id: str, team: str) -> Strip:
    """Rule 6: split by the drive's starting quarter; OT is its own segment when present."""
    x = dr[(dr.game_id == game_id) & (dr.team == team)]
    out = [list(x[x.q0 <= 2].s), list(x[(x.q0 > 2) & (x.q0 <= 4)].s)]
    ot = list(x[x.q0 > 4].s)
    if ot:
        out.append(ot)
    return out


@dataclass
class Game:
    id: str
    week: int
    day: str  # schedule gameday (US Eastern date)
    time: str  # schedule gametime, HH:MM US Eastern
    away: str  # display abbr
    home: str
    final: bool
    a_score: int | None = None
    h_score: int | None = None
    a_strip: Strip | None = None
    h_strip: Strip | None = None


def games(pbp: pd.DataFrame, sched: pd.DataFrame) -> list[Game]:
    """Every scheduled game, sorted by kickoff. A game is final once it appears in pbp."""
    dr = drives(pbp)
    scores = pbp.groupby("game_id")[["away_score", "home_score"]].last()  # rule 7
    out = []
    for r in sched.sort_values(["gameday", "gametime", "game_id"]).itertuples():
        g = Game(id=r.game_id, week=int(r.week), day=r.gameday, time=r.gametime,
                 away=config.abbr(r.away_team), home=config.abbr(r.home_team),
                 final=r.game_id in scores.index)
        if g.final:
            g.a_score, g.h_score = (int(v) for v in scores.loc[r.game_id])
            g.a_strip = strip(dr, r.game_id, r.away_team)
            g.h_strip = strip(dr, r.game_id, r.home_team)
        out.append(g)
    return out
