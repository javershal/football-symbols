"""Golden strips from BRIEF.md. These must pass exactly; CI blocks deploy otherwise."""

import pytest

GOLDEN = [
    ("2026_01_WAS_PHI", "PHI", "⬜⬜🟩⬜🟩⬜ | ⬜⬜⬜🟢🟩⏹️"),
    ("2026_01_WAS_PHI", "WAS", "🟢⬜⬜⬜⬜🟩⏸️ | ⬜⭕⬜🟩🟩"),
    ("2026_02_PHI_TEN", "PHI", "🔺🟩🟩 | ⬜🟢⬜🔺🟩"),
    ("2026_03_PHI_CHI", "PHI", "⬜🔺🔺🟩 | ⬜⬜⬜🔺🔻"),
    ("2026_03_PHI_CHI", "CHI", "🟩⬜🔻🟢 | 🟢🟩⬜🟩⏹️"),
    ("2026_04_PIT_CLE", "PIT", "🟩🔺⬜⭕🟢 | ⬜⬜⬜🟩⬜🟩🔺"),
    ("2026_04_PIT_CLE", "CLE", "⬜⬜🟩🟩🟩⏸️ | ⬜🔺🔺🟢⬜🟢⏹️"),
]


def text(strip):
    return " | ".join("".join(p) for p in strip)


def team_strip(g, team):
    return g.a_strip if g.away == team else g.h_strip


@pytest.mark.parametrize("game_id,team,expected", GOLDEN)
def test_golden(games, game_id, team, expected):
    g = games[game_id]
    assert g.final
    assert text(team_strip(g, team)) == expected


def test_kickoff_fumble_inserts_turnover(pbp):
    """W3 CAR at CLE: CLE lost a kickoff fumble; it becomes its own CLE 🔺 possession
    immediately before CAR's resulting drive (rule 4)."""
    from football_symbols.derive import drives

    dr = drives(pbp)
    g = dr[dr.game_id == "2026_03_CAR_CLE"].reset_index(drop=True)
    i = g.index[g.fd % 1 == 0.5]
    assert len(i) == 1
    ko, nxt = g.loc[i[0]], g.loc[i[0] + 1]
    assert (ko.team, ko.s) == ("CLE", "🔺")
    assert nxt.team == "CAR" and nxt.fd == ko.fd + 0.5


@pytest.mark.parametrize("game_id", ["2026_01_NO_DET", "2026_02_GB_NYJ", "2026_02_IND_KC"])
def test_overtime_second_pipe(games, game_id):
    g = games[game_id]
    assert len(g.a_strip) == len(g.h_strip) == 3
    assert text(g.a_strip).count(" | ") == 2


def test_no_ot_segment_in_regulation_games(games):
    ot = {"2026_01_NO_DET", "2026_02_GB_NYJ", "2026_02_IND_KC"}
    for g in games.values():
        if g.final and g.id[:7] <= "2026_02" and g.id not in ot:
            assert len(g.a_strip) == len(g.h_strip) == 2, g.id


def test_scores_match_schedule(games, sched):
    s = sched.set_index("game_id")
    for g in games.values():
        if g.final and s.loc[g.id].notna().home_score:
            assert (g.a_score, g.h_score) == (s.loc[g.id].away_score, s.loc[g.id].home_score)


def test_rams_display_as_lar(games):
    teams = {t for g in games.values() for t in (g.away, g.home)}
    assert "LAR" in teams and "LA" not in teams
