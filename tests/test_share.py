import regex

from football_symbols import share
from football_symbols.derive import Game

BLUESKY_LIMIT = 300


def graphemes(s: str) -> int:
    return len(regex.findall(r"\X", s))


def test_copy_format_matches_brief(games):
    assert share.game_text(games["2026_04_PIT_CLE"]) == (
        "Browns 27, Steelers 24:\n"
        "PIT 🟩🔺⬜⭕🟢 | ⬜⬜⬜🟩⬜🟩🔺\n"
        "CLE ⬜⬜🟩🟩🟩⏸️ | ⬜🔺🔺🟢⬜🟢⏹️"
    )


def test_winner_first_when_away_wins(games):
    g = games["2026_04_IND_WAS"]
    assert share.game_text(g).startswith("Colts 30, Commanders 13:\nIND ")


def test_week_text(games):
    wk = [g for g in games.values() if g.week == 4]
    t = share.week_text(4, wk)
    assert t.startswith("Week 4\n\n")
    assert t.count(":\n") == sum(g.final for g in wk)
    assert "\n\n\n" not in t


def test_every_final_game_fits_bluesky(games):
    for g in games.values():
        if g.final:
            assert graphemes(share.game_text(g)) < BLUESKY_LIMIT, g.id


def test_worst_case_fits_bluesky():
    """Longest names, triple-digit scores, 15 drives a half each side, plus OT."""
    long = [["⏸️"] * 15, ["♦️"] * 15, ["⏹️"] * 4]
    g = Game(id="x", week=1, day="", time="", away="TB", home="WAS", final=True,
             a_score=100, h_score=99, a_strip=long, h_strip=long)
    assert graphemes(share.game_text(g)) < BLUESKY_LIMIT


def test_emoji_variation_selectors_kept(games):
    t = share.game_text(games["2026_04_PIT_CLE"])
    assert "⏸️" in t and "⏹️" in t
