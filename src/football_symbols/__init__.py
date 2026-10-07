"""Possession Strips: every NFL drive as an emoji, built into a static site."""

SEASON = 2026


def main() -> None:
    from .cli import main as cli_main

    cli_main()
