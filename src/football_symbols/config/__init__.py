"""Locked configuration: legend and teams. Edit the JSON files, not this module."""

import json
from functools import cache
from importlib.resources import files


@cache
def legend() -> dict:
    return json.loads(files(__package__).joinpath("legend.json").read_text("utf-8"))


@cache
def teams() -> dict:
    return json.loads(files(__package__).joinpath("teams.json").read_text("utf-8"))


def result_emoji() -> dict[str, str]:
    """fixed_drive_result -> emoji, for every result except End of half."""
    return {o["result"]: o["emoji"] for o in legend()["outcomes"] if "when" not in o}


def end_of_half_emoji() -> tuple[str, str]:
    """(before Q4, Q4 or later)."""
    by_when = {o["when"]: o["emoji"] for o in legend()["outcomes"] if "when" in o}
    return by_when["q1-q3"], by_when["q4+"]


def abbr(team: str) -> str:
    return teams()["aliases"].get(team, team)
