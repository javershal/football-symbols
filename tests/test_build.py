import pytest

from football_symbols import build


@pytest.fixture(scope="session")
def data(games):
    return build.build_data(list(games.values()), 2026)


def test_every_team_has_18_rows_with_byes(data):
    for d in data["2026/standings.json"]["divisions"]:
        for t in d["teams"]:
            assert [r["week"] for r in t["games"]] == list(range(1, 19))
            assert sum(r.get("bye", False) for r in t["games"]) == 1, t["team"]


def test_records_match_results(data, games):
    wins = sum(t["w"] for d in data["2026/standings.json"]["divisions"] for t in d["teams"])
    finals = [g for g in games.values() if g.final]
    ties = sum(g.a_score == g.h_score for g in finals)
    assert wins == len(finals) - ties


def test_divisions_sorted_by_record_then_diff(data):
    for d in data["2026/standings.json"]["divisions"]:
        keys = [build.standings_key(t) for t in d["teams"]]
        assert keys == sorted(keys), d["name"]


def test_team_rows_carry_both_strips(data):
    phi = data["2026/teams/PHI.json"]
    w1 = phi["games"][0]
    assert (w1["id"], w1["home"], w1["opp"]) == ("2026_01_WAS_PHI", True, "WAS")
    assert " | ".join("".join(p) for p in w1["strip"]) == "⬜⬜🟩⬜🟩⬜ | ⬜⬜⬜🟢🟩⏹️"
    assert " | ".join("".join(p) for p in w1["oppStrip"]) == "🟢⬜⬜⬜⬜🟩⏸️ | ⬜⭕⬜🟩🟩"


def test_kickoff_converts_eastern_to_utc_across_dst(games):
    g = next(g for g in games.values() if g.day == "2026-11-08" and g.time == "13:00")
    assert build.kickoff_utc(g) == "2026-11-08T18:00:00Z"  # EST, -5
    g = next(g for g in games.values() if g.day == "2026-10-11" and g.time == "13:00")
    assert build.kickoff_utc(g) == "2026-10-11T17:00:00Z"  # EDT, -4
