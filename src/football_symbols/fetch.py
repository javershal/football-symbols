"""Download nflverse inputs into a local cache directory."""

import time
import urllib.request
from pathlib import Path

PBP_URL = "https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_{season}.csv.gz"
SCHEDULE_URL = "https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv"


def _get(url: str, dest: Path, tries: int = 4) -> None:
    tmp = dest.with_suffix(dest.suffix + ".part")
    for i in range(tries):
        try:
            with urllib.request.urlopen(url, timeout=60) as r, open(tmp, "wb") as f:
                f.write(r.read())
            tmp.replace(dest)
            return
        except OSError:
            if i == tries - 1:
                raise
            time.sleep(2**i * 5)


def fetch(cache: Path, season: int) -> None:
    cache.mkdir(parents=True, exist_ok=True)
    _get(PBP_URL.format(season=season), cache / "pbp.csv.gz")
    _get(SCHEDULE_URL, cache / "games.csv")
