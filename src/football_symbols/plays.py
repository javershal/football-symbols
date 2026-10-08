"""Per-play drive charts for the game page: every drive in strip order, each with its snaps.

Positions are yardline_100 from the offense's view (100 = own goal line, 0 = opponent's).
A play runs from its snap to the next snap, so penalty yardage is folded into the play.
"""

import re

import pandas as pd

from . import config, derive

SNAPS = {"pass", "run", "punt", "field_goal", "qb_kneel", "qb_spike"}
KIND = {"field_goal": "fg", "qb_kneel": "kneel", "qb_spike": "spike"}


def kind(r) -> str:
    if r.play_type == "no_play":
        return "pen"
    if r.play_type == "pass":
        if r.sack == 1:
            return "sack"
        if r.interception == 1:
            return "int"
        return "pass" if r.complete_pass == 1 else "inc"
    return KIND.get(r.play_type, r.play_type)


def clock(s) -> str:
    """'07:29' -> '7:29', '00:37' -> '0:37'."""
    return re.sub(r"^0(\d)", r"\1", s) if isinstance(s, str) else ""


def desc(s: str) -> str:
    """Drop the leading clock and formation tags; the page shows the clock separately."""
    return re.sub(r"\((Shotgun|No Huddle[^)]*)\)\s*", "", re.sub(r"^\(\d+:\d+\)\s*", "", s)).strip()


def snaps(x: pd.DataFrame, team: str) -> list[dict]:
    s = x[(x.posteam == team) & x.yardline_100.notna()
          & (x.play_type.isin(SNAPS) | ((x.play_type == "no_play") & (x.penalty == 1)))]
    rows = list(s.itertuples())
    td = next((i for i, r in enumerate(rows) if r.touchdown == 1 and r.td_team == team), None)
    if td is not None:  # the try (two-point attempt, penalties on it) is filed under the same drive
        rows = rows[:td + 1]
    out = []
    for i, r in enumerate(rows):
        a = int(r.yardline_100)
        if r.touchdown == 1 and r.td_team == team:
            b = 0
        elif i + 1 < len(rows):
            b = int(rows[i + 1].yardline_100)
        elif r.play_type in ("punt", "field_goal"):
            b = a
        else:
            b = a - int(r.yards_gained if pd.notna(r.yards_gained) else 0)
        p = dict(k=kind(r), a=a, b=b, q=int(r.qtr), t=clock(r.time),
                 desc=desc(r.desc))
        if pd.notna(r.down):
            p.update(dn=int(r.down), togo=int(r.ydstogo))
        if r.penalty == 1:
            p["pen"] = 1
        if r.first_down == 1:
            p["fd"] = 1
        if r.play_type == "pass" and pd.notna(r.air_yards):
            p["air"] = int(r.air_yards)
        if r.play_type in ("punt", "field_goal") and pd.notna(r.kick_distance):
            p["kick"] = int(r.kick_distance)
        if r.play_type == "field_goal":
            p["fg"] = r.field_goal_result
        out.append(p)
    return out


def last(x: pd.Series):
    x = x.dropna()
    return x.iloc[-1] if len(x) else None


def game_drives(pbp: pd.DataFrame) -> dict[str, list[dict]]:
    """game_id -> drives in strip order. `h` is the strip segment (0 first half, 1 second, 2 OT)."""
    dr = derive.drives(pbp)
    out: dict[str, list[dict]] = {}
    by_drive = {k: x for k, x in pbp.groupby(["game_id", "fixed_drive"], sort=False)}
    for d in dr.itertuples():
        h = 0 if d.q0 <= 2 else 1 if d.q0 <= 4 else 2
        row = dict(team=config.abbr(d.team), s=d.s, h=h, q=int(d.q0))
        x = by_drive.get((d.game_id, d.fd))
        if x is not None:  # the lost-kickoff-fumble possession (fd + .5) has no snaps
            kicks = x[x.play_type.isin(["field_goal", "punt"])]
            row.update(top=clock(last(x.drive_time_of_possession)),
                       kicker=last(kicks.kicker_player_name), scorer=last(x.td_player_name),
                       plays=snaps(x, d.team))
        else:
            row["plays"] = []
        out.setdefault(d.game_id, []).append({k: v for k, v in row.items() if v is not None})
    return out
