#!/usr/bin/env python3
"""
Generate a mobile-friendly Meta Ads HTML report.

Live mode:
  Set META_ACCESS_TOKEN and META_AD_ACCOUNT_ID as GitHub secrets.
  Then run this script manually or through GitHub Actions.

Fallback mode:
  If secrets are missing, the script still generates a safe static report.
"""

from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DEFAULT_REPORT_DATA = {
    "date": "2026-06-21",
    "updated_at": "Static fallback",
    "brand": "The Clarity Shop",
    "campaign": "Sales / Purchase test",
    "spend": "10,92 kr",
    "impressions": "7 200",
    "reach": "3 241",
    "link_clicks": "3",
    "ctr": "0,04%",
    "cpc": "3,64 kr",
    "purchases": "0",
    "cost_per_purchase": "-",
    "diagnosis": "Static fallback: add META_ACCESS_TOKEN and META_AD_ACCOUNT_ID to GitHub secrets to pull live Meta Ads data.",
    "mode": "Static fallback",
}


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def money(value: Any, suffix: str = " kr") -> str:
    try:
        amount = float(value)
    except (TypeError, ValueError):
        return "-"
    return f"{amount:,.2f}".replace(",", " ").replace(".", ",") + suffix


def number(value: Any) -> str:
    try:
        amount = float(value)
    except (TypeError, ValueError):
        return "0"
    if amount.is_integer():
        return f"{int(amount):,}".replace(",", " ")
    return f"{amount:,.2f}".replace(",", " ").replace(".", ",")


def percent(value: Any) -> str:
    try:
        amount = float(value)
    except (TypeError, ValueError):
        return "0%"
    return f"{amount:.2f}%".replace(".", ",")


def get_action_value(actions: list[dict[str, Any]] | None, names: tuple[str, ...]) -> float:
    if not actions:
        return 0.0
    for item in actions:
        if item.get("action_type") in names:
            try:
                return float(item.get("value", 0))
            except (TypeError, ValueError):
                return 0.0
    return 0.0


def fetch_meta_data() -> dict[str, str]:
    access_token = env("META_ACCESS_TOKEN")
    ad_account_id = env("META_AD_ACCOUNT_ID")
    api_version = env("META_API_VERSION", "v20.0")
    brand = env("REPORT_BRAND", "The Clarity Shop")
    campaign = env("REPORT_CAMPAIGN", "Meta Ads live report")

    if not access_token or not ad_account_id:
        return DEFAULT_REPORT_DATA | {
            "brand": brand,
            "campaign": campaign,
            "date": datetime.now(timezone.utc).date().isoformat(),
            "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        }

    if not ad_account_id.startswith("act_"):
        ad_account_id = f"act_{ad_account_id}"

    fields = [
        "spend",
        "impressions",
        "reach",
        "clicks",
        "inline_link_clicks",
        "ctr",
        "cpc",
        "actions",
        "cost_per_action_type",
    ]

    params = urllib.parse.urlencode(
        {
            "fields": ",".join(fields),
            "date_preset": env("META_DATE_PRESET", "today"),
            "level": env("META_LEVEL", "account"),
            "access_token": access_token,
        }
    )

    url = f"https://graph.facebook.com/{api_version}/{ad_account_id}/insights?{params}"

    try:
        with urllib.request.urlopen(url, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception as error:
        return DEFAULT_REPORT_DATA | {
            "brand": brand,
            "campaign": campaign,
            "date": datetime.now(timezone.utc).date().isoformat(),
            "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
            "diagnosis": f"Live fetch failed: {error}",
            "mode": "Meta API error",
        }

    rows = payload.get("data", [])
    if not rows:
        return DEFAULT_REPORT_DATA | {
            "brand": brand,
            "campaign": campaign,
            "date": datetime.now(timezone.utc).date().isoformat(),
            "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
            "diagnosis": "Meta API returned no rows for the selected period.",
            "mode": "No Meta data",
        }

    row = rows[0]
    spend = row.get("spend", "0")
    actions = row.get("actions", [])
    cost_actions = row.get("cost_per_action_type", [])

    purchases = get_action_value(actions, ("purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"))
    cost_per_purchase = get_action_value(cost_actions, ("purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"))

    ctr_value = row.get("ctr", "0")
    diagnosis = diagnose(float(ctr_value or 0), purchases)

    return {
        "date": datetime.now(timezone.utc).date().isoformat(),
        "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "brand": brand,
        "campaign": campaign,
        "spend": money(spend),
        "impressions": number(row.get("impressions", 0)),
        "reach": number(row.get("reach", 0)),
        "link_clicks": number(row.get("inline_link_clicks") or row.get("clicks") or 0),
        "ctr": percent(ctr_value),
        "cpc": money(row.get("cpc", 0)),
        "purchases": number(purchases),
        "cost_per_purchase": money(cost_per_purchase) if cost_per_purchase else "-",
        "diagnosis": diagnosis,
        "mode": "Live Meta API",
    }


def diagnose(ctr_value: float, purchases: float) -> str:
    if purchases > 0:
        return "Purchase signal found. Next step: check cost per purchase, offer strength, and scaling room."
    if ctr_value < 0.5:
        return "CTR is weak. Fix creative, hook, and first line before scaling spend."
    if ctr_value < 1.0:
        return "CTR is acceptable but not strong. Test sharper hooks and compare landing page behavior."
    return "CTR is strong enough to inspect checkout, offer, pricing, and purchase conversion."


def render_html(data: dict[str, str]) -> str:
    return f"""<!doctype html>
<html lang=\"sv\">
<head>
  <meta charset=\"utf-8\" />
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\" />
  <meta name=\"theme-color\" content=\"#0f172a\" />
  <title>Meta Ads Report - {data['brand']}</title>
  <style>
    :root {{
      --bg: #f6f1e8;
      --panel: #fffaf2;
      --ink: #1f2933;
      --muted: #667085;
      --line: rgba(151, 124, 80, 0.25);
      --gold: #b99255;
      --rose: #c88f8f;
      --danger: #b54747;
      --ok: #2f7d57;
      --shadow: 0 18px 50px rgba(33, 25, 15, 0.10);
      --radius: 24px;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif;
      background:
        radial-gradient(circle at top left, rgba(200, 143, 143, 0.18), transparent 34%),
        radial-gradient(circle at top right, rgba(185, 146, 85, 0.18), transparent 34%),
        var(--bg);
      color: var(--ink);
      line-height: 1.5;
    }}
    .wrap {{ width: min(1120px, 100%); margin: 0 auto; padding: 24px 16px 48px; }}
    .hero {{
      background: linear-gradient(135deg, rgba(255, 250, 242, 0.96), rgba(247, 239, 225, 0.94));
      border: 1px solid var(--line);
      border-radius: 32px;
      box-shadow: var(--shadow);
      padding: 28px;
      position: relative;
      overflow: hidden;
    }}
    .eyebrow {{ text-transform: uppercase; letter-spacing: 0.16em; color: var(--gold); font-size: 12px; font-weight: 800; margin: 0 0 12px; }}
    h1 {{ font-family: Georgia, \"Times New Roman\", serif; font-size: clamp(34px, 7vw, 72px); line-height: 0.95; margin: 0; max-width: 800px; }}
    h2 {{ font-family: Georgia, \"Times New Roman\", serif; font-size: 30px; margin: 0 0 12px; }}
    .sub {{ color: var(--muted); max-width: 780px; margin: 18px 0 0; font-size: 17px; }}
    .status-row {{ display: flex; flex-wrap: wrap; gap: 10px; margin-top: 22px; }}
    .pill {{ border: 1px solid var(--line); background: rgba(255, 255, 255, 0.55); border-radius: 999px; padding: 9px 13px; color: var(--muted); font-size: 13px; font-weight: 700; }}
    .grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-top: 18px; }}
    .card, .section {{ background: rgba(255, 250, 242, 0.90); border: 1px solid var(--line); border-radius: var(--radius); padding: 18px; box-shadow: 0 10px 30px rgba(33, 25, 15, 0.06); }}
    .section {{ margin-top: 18px; border-radius: 28px; padding: 22px; }}
    .label {{ color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.10em; font-weight: 800; margin-bottom: 8px; }}
    .value {{ font-size: 31px; font-weight: 900; letter-spacing: -0.03em; }}
    .note {{ color: var(--muted); font-size: 13px; margin-top: 6px; }}
    .red {{ color: var(--danger); font-weight: 900; }}
    .green {{ color: var(--ok); font-weight: 900; }}
    .footer {{ color: var(--muted); text-align: center; font-size: 13px; padding: 24px 0 0; }}
    a {{ color: inherit; text-decoration-color: rgba(185, 146, 85, 0.55); text-underline-offset: 4px; }}
    @media (max-width: 820px) {{ .wrap {{ padding: 14px 12px 38px; }} .hero {{ padding: 22px; border-radius: 26px; }} .grid {{ grid-template-columns: repeat(2, 1fr); }} .value {{ font-size: 27px; }} h2 {{ font-size: 26px; }} }}
    @media (max-width: 440px) {{ .grid {{ grid-template-columns: 1fr; }} .section {{ padding: 18px; }} }}
  </style>
</head>
<body>
  <main class=\"wrap\">
    <section class=\"hero\">
      <p class=\"eyebrow\">{data['brand']} · Meta Ads</p>
      <h1>Daily Performance Report</h1>
      <p class=\"sub\">Mobilvänlig Meta Ads-dashboard. Den här sidan uppdateras via GitHub Actions när Meta API-secrets finns på plats.</p>
      <div class=\"status-row\">
        <span class=\"pill\">Report date: {data['date']}</span>
        <span class=\"pill\">Updated: {data['updated_at']}</span>
        <span class=\"pill\">Mode: {data['mode']}</span>
        <span class=\"pill\">Campaign: {data['campaign']}</span>
      </div>
    </section>

    <section class=\"grid\" aria-label=\"Meta Ads key metrics\">
      <article class=\"card\"><div class=\"label\">Spend</div><div class=\"value\">{data['spend']}</div><div class=\"note\">Annonskostnad hittills.</div></article>
      <article class=\"card\"><div class=\"label\">Impressions</div><div class=\"value\">{data['impressions']}</div><div class=\"note\">Visningar.</div></article>
      <article class=\"card\"><div class=\"label\">Reach</div><div class=\"value\">{data['reach']}</div><div class=\"note\">Unika personer.</div></article>
      <article class=\"card\"><div class=\"label\">Link clicks</div><div class=\"value red\">{data['link_clicks']}</div><div class=\"note\">Klick mot sidan.</div></article>
      <article class=\"card\"><div class=\"label\">CTR</div><div class=\"value red\">{data['ctr']}</div><div class=\"note\">Scroll-stop signal.</div></article>
      <article class=\"card\"><div class=\"label\">CPC</div><div class=\"value\">{data['cpc']}</div><div class=\"note\">Kostnad per klick.</div></article>
      <article class=\"card\"><div class=\"label\">Purchases</div><div class=\"value green\">{data['purchases']}</div><div class=\"note\">Köp enligt Meta.</div></article>
      <article class=\"card\"><div class=\"label\">Cost / purchase</div><div class=\"value\">{data['cost_per_purchase']}</div><div class=\"note\">Om purchase-data finns.</div></article>
    </section>

    <section class=\"section\">
      <h2>Diagnosis</h2>
      <p>{data['diagnosis']}</p>
    </section>

    <p class=\"footer\">Generated for Lajo · The Clarity Shop · <a href=\"archive/{data['date']}.html\">Open archived report</a></p>
  </main>
</body>
</html>
"""


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    report_dir = root / "reports" / "meta-ads"
    archive_dir = report_dir / "archive"
    archive_dir.mkdir(parents=True, exist_ok=True)

    data = fetch_meta_data()
    html = render_html(data)
    (report_dir / "latest.html").write_text(html, encoding="utf-8")
    (archive_dir / f"{data['date']}.html").write_text(html, encoding="utf-8")

    print("Report generated:")
    print(report_dir / "latest.html")
    print(archive_dir / f"{data['date']}.html")


if __name__ == "__main__":
    main()
