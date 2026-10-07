import argparse
from pathlib import Path

from . import SEASON


def main() -> None:
    p = argparse.ArgumentParser(prog="football-symbols")
    p.add_argument("--cache", type=Path, default=Path(".cache"))
    p.add_argument("--site", type=Path, default=Path("site"))
    p.add_argument("--season", type=int, default=SEASON)
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("fetch", help="download nflverse pbp + schedule")
    sub.add_parser("build", help="derive possessions and write site/data JSON + route pages")
    sub.add_parser("serve", help="serve site/ at http://localhost:8000 for local preview")
    a = p.parse_args()

    if a.cmd == "fetch":
        from .fetch import fetch

        fetch(a.cache, a.season)
    elif a.cmd == "build":
        from .build import build
        from .pages import write_pages

        changed = build(a.cache, a.site, a.season)
        write_pages(a.site, a.season)
        print(f"{len(changed)} data files changed" + (f": {', '.join(changed[:8])}…" if changed else ""))
    elif a.cmd == "serve":
        import functools
        import http.server

        h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(a.site))
        print("http://localhost:8000/")
        http.server.ThreadingHTTPServer(("127.0.0.1", 8000), h).serve_forever()
