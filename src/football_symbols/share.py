"""Copy-to-clipboard text. The site uses these strings verbatim."""

from . import config
from .derive import Game, Strip


def strip_text(strip: Strip) -> str:
    pipe = config.legend()["pipe"]
    return f" {pipe} ".join("".join(p) for p in strip)


def game_text(g: Game) -> str:
    """Winner first in the header; then away row, then home row. Ties keep away first."""
    names = config.teams()["teams"]
    a, h = (names[g.away]["name"], g.a_score), (names[g.home]["name"], g.h_score)
    w, l = (h, a) if g.h_score > g.a_score else (a, h)
    return (f"{w[0]} {w[1]}, {l[0]} {l[1]}:\n"
            f"{g.away} {strip_text(g.a_strip)}\n"
            f"{g.home} {strip_text(g.h_strip)}")


def week_text(week: int, games: list[Game]) -> str:
    return f"Week {week}\n\n" + "\n\n".join(game_text(g) for g in games if g.final)
