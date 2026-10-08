"""Game-page drive charts: drives must line up with the strips, and plays must chain snap to snap."""

import pytest

from football_symbols import build, plays


@pytest.fixture(scope="session")
def drives(pbp):
    return plays.game_drives(pbp)


def rebuilt(ds, team):
    segs = [[], [], []]
    for d in ds:
        if d["team"] == team:
            segs[d["h"]].append(d["s"])
    return segs[:2] + ([segs[2]] if segs[2] else [])


def test_drives_rebuild_every_strip(games, drives):
    """The game page draws its strips from the drives, so they must match the published strips."""
    for g in games.values():
        if g.final:
            assert rebuilt(drives[g.id], g.away) == g.a_strip, (g.id, g.away)
            assert rebuilt(drives[g.id], g.home) == g.h_strip, (g.id, g.home)


def test_plays_chain_snap_to_snap(drives):
    for gid, ds in drives.items():
        for d in ds:
            ps = d["plays"]
            for p, nxt in zip(ps, ps[1:]):
                assert p["b"] == nxt["a"], (gid, d["team"], p["desc"])
            if d["s"] == "🟩":
                assert ps[-1]["b"] == 0, (gid, ps[-1]["desc"])


def test_field_goal_drive(drives):
    """W1 ARI at LAC: ARI's 34-yard FG drive from its own 10 (penalty-free, ten snaps)."""
    d = next(d for d in drives["2026_01_ARI_LAC"]
             if d.get("kicker") == "C.Ryland" and d["plays"][-1].get("kick") == 34)
    ps = d["plays"]
    assert (d["s"], d["top"], ps[0]["a"], len(ps)) == ("🟢", "4:41", 90, 10)
    assert [p["k"] for p in ps] == ["run", "pass", "run", "pass", "pass", "run", "run", "inc", "inc", "fg"]
    assert (ps[-1]["fg"], ps[-1]["a"], ps[1]["air"]) == ("made", 15, 28)
    assert ps[0]["desc"].startswith("4-J.Love right tackle")  # clock prefix stripped


def test_lost_kickoff_fumble_has_no_snaps(drives):
    d = [d for d in drives["2026_03_CAR_CLE"] if not d["plays"]]
    assert [(x["team"], x["s"]) for x in d] == [("CLE", "🔺")]


def test_game_files_only_carry_drives_when_final(games, drives):
    data = build.build_data(list(games.values()), 2026, drives)
    final = data["2026/games/2026_01_ARI_LAC.json"]
    assert final["drives"] and final["copy"].startswith("Cardinals 26")
    upcoming = next(v for k, v in data.items() if k.startswith("2026/games/") and not v["final"])
    assert "drives" not in upcoming
