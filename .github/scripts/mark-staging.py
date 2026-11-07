#!/usr/bin/env python3
"""Mark an assembled copy of the web client as the staging preview.

The staging site is the same app, on the same origin, as production — the only
difference is the path. That is exactly why it needs a marker: a reader who
lands on /develop/ should not have to read the URL bar to know which one they
are on, and a crawler should not index a second copy of the product.

Run by the Pages workflow over `site/develop/` after the branch has been copied
in. It edits one file and touches nothing else.

    python3 .github/scripts/mark-staging.py site/develop
"""

import sys
from pathlib import Path

BANNER = (
    '<div role="status" style="position:fixed;left:0;right:0;bottom:0;z-index:9999;'
    "font:12px/1.7 system-ui,-apple-system,sans-serif;text-align:center;padding:5px 10px;"
    'background:#2f6df6;color:#fff">'
    "Staging preview &middot; <strong>develop</strong> &middot; "
    '<a href="../" style="color:#fff;text-decoration:underline">production</a>'
    "</div>"
)

NOINDEX = '<meta name="robots" content="noindex, nofollow" />'


def main(argv):
    if len(argv) != 2:
        print("usage: mark-staging.py <directory>", file=sys.stderr)
        return 2

    page = Path(argv[1]) / "index.html"
    html = page.read_text(encoding="utf-8")

    if NOINDEX not in html:
        if "<head>" not in html:
            print(f"{page}: no <head> to mark", file=sys.stderr)
            return 1
        html = html.replace("<head>", f"<head>\n  {NOINDEX}", 1)

    if "Staging preview" not in html:
        if "<body>" not in html:
            print(f"{page}: no <body> to mark", file=sys.stderr)
            return 1
        html = html.replace("<body>", f"<body>\n{BANNER}", 1)

    page.write_text(html, encoding="utf-8")
    print(f"marked {page} as the staging preview")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
