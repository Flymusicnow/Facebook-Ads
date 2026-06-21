#!/usr/bin/env python3
"""
Generate a mobile-friendly Meta Ads HTML report.

Usage:
  python scripts/fetch-meta-report.py

This script currently uses a local data object. Later we can connect it to the Meta Marketing API
and replace REPORT_DATA with live campaign numbers.
"""

from __future__ import annotations

from datetime import date
from pathlib import Path

REPORT_DATA = {
    "date": "2026-06-21",
    "brand": "The Clarity Shop",
    "campaign": "Sales / Purchase test",
    "spend": "10,92 kr",
    "impressions": "7 200",
    "reach": "3 241",
    "link_clicks": "3",
    "ctr": "0,04%",
    "cpc": "3,64 kr",
    "diagnosis": "Creative and hook need stronger scroll-stop power before scaling.",
}


def render_html(data: dict[str, str]) -> str:
    return f"""<!doctype html>
<html lang=\"sv\">
<head>
  <meta charset=\"utf-8\" />
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
  <title>Meta Ads Report - {data['brand']}</title>
  <style>
    body {{ margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif; background: #f6f1e8; color: #1f2933; }}
    main {{ width: min(980px, 100%); margin: 0 auto; padding: 18px; }}
    section {{ background: #fffaf2; border: 1px solid rgba(151,124,80,.25); border-radius: 24px; padding: 22px; margin-bottom: 14px; }}
    h1 {{ font-family: Georgia, serif; font-size: clamp(34px, 8vw, 64px); line-height: .95; margin: 0; }}
    .muted {{ color: #667085; }}
    .grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }}
    .card {{ border: 1px solid rgba(151,124,80,.25); border-radius: 18px; padding: 16px; background: rgba(255,255,255,.45); }}
    .label {{ font-size: 12px; text-transform: uppercase; letter-spacing: .1em; color: #667085; font-weight: 800; }}
    .value {{ font-size: 30px; font-weight: 900; }}
    .red {{ color: #b54747; }}
    @media (max-width: 720px) {{ .grid {{ grid-template-columns: 1fr; }} }}
  </style>
</head>
<body>
  <main>
    <section>
      <p class=\"muted\">{data['brand']} · Meta Ads · {data['date']}</p>
      <h1>Daily Performance Report</h1>
      <p>{data['campaign']}</p>
    </section>
    <section class=\"grid\">
      <div class=\"card\"><div class=\"label\">Spend</div><div class=\"value\">{data['spend']}</div></div>
      <div class=\"card\"><div class=\"label\">Impressions</div><div class=\"value\">{data['impressions']}</div></div>
      <div class=\"card\"><div class=\"label\">Reach</div><div class=\"value\">{data['reach']}</div></div>
      <div class=\"card\"><div class=\"label\">Link clicks</div><div class=\"value red\">{data['link_clicks']}</div></div>
      <div class=\"card\"><div class=\"label\">CTR</div><div class=\"value red\">{data['ctr']}</div></div>
      <div class=\"card\"><div class=\"label\">CPC</div><div class=\"value\">{data['cpc']}</div></div>
    </section>
    <section>
      <h2>Diagnosis</h2>
      <p>{data['diagnosis']}</p>
    </section>
  </main>
</body>
</html>
"""


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    report_dir = root / "reports" / "meta-ads"
    archive_dir = report_dir / "archive"
    archive_dir.mkdir(parents=True, exist_ok=True)

    html = render_html(REPORT_DATA)
    (report_dir / "latest.html").write_text(html, encoding="utf-8")
    (archive_dir / f"{REPORT_DATA.get('date', date.today().isoformat())}.html").write_text(html, encoding="utf-8")

    print("Report generated:")
    print(report_dir / "latest.html")
    print(archive_dir / f"{REPORT_DATA.get('date', date.today().isoformat())}.html")


if __name__ == "__main__":
    main()
