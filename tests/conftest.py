import os
from pathlib import Path

import pytest

from football_symbols import derive

DATA = Path(os.environ.get("FS_CACHE", Path(__file__).parent.parent / ".cache"))


@pytest.fixture(scope="session")
def pbp():
    path = DATA / "pbp.csv.gz"
    if not path.exists():  # fail, never skip: missing data must block a deploy
        pytest.fail(f"{path} missing; run `uv run football-symbols fetch` first")
    return derive.read_pbp(path)


@pytest.fixture(scope="session")
def sched():
    return derive.read_schedule(DATA / "games.csv", 2026)


@pytest.fixture(scope="session")
def games(pbp, sched):
    return {g.id: g for g in derive.games(pbp, sched)}
