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
    win, lose = (h, a) if g.h_score > g.a_score else (a, h)
    return (f"{win[0]} {win[1]}, {lose[0]} {lose[1]}:\n"
            f"{g.away} {strip_text(g.a_strip)}\n"
            f"{g.home} {strip_text(g.h_strip)}")

