#!/usr/bin/env python3
"""
Generate a mobile-friendly Meta Ads HTML report.

Required GitHub secrets:
  META_ACCESS_TOKEN
  META_AD_ACCOUNT_ID

Optional:
  META_API_VERSION, defaults to v25.0
"""

from __future__ import annotations

import html
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DEFAULT_REPORT_DATA = {
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
    "roas": "-",
}

PERIOD_LABELS = {
    "today": "Today",
    "yesterday": "Yesterday",
    "last_7d": "Last 7 days",
    "last_14d": "Last 14 days",
    "last_30d": "Last 30 days",
    "this_month": "This month",
    "last_month": "Last month",
    "maximum": "Maximum",
}

PURCHASE_ACTIONS = ("purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase")
LOW_IMPRESSIONS = 100


def env(name: str, default: str = "") -> str:
    value = os.environ.get(name, "").strip()
    return value if value else default


def now_date() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def now_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def to_float(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def money(value: Any, suffix: str = " kr") -> str:
    amount = to_float(value)
    return f"{amount:,.2f}".replace(",", " ").replace(".", ",") + suffix


def number(value: Any) -> str:
    amount = to_float(value)
    if amount.is_integer():
        return f"{int(amount):,}".replace(",", " ")
    return f"{amount:,.2f}".replace(",", " ").replace(".", ",")


def percent(value: Any) -> str:
    return f"{to_float(value):.2f}%".replace(".", ",")


def safe(value: Any) -> str:
    return html.escape(str(value), quote=True)


def compact(value: str, limit: int = 900) -> str:
    value = " ".join(str(value).split())
    return value[:limit] + "..." if len(value) > limit else value


def parse_meta_error(body: str) -> str:
    if not body:
        return "Meta returned an empty error body."
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        return compact(body)

    error = payload.get("error", payload)
    if not isinstance(error, dict):
        return compact(body)

    parts = []
    for key in ("message", "type", "code", "error_subcode", "error_user_title", "error_user_msg", "fbtrace_id"):
        value = error.get(key)
        if value not in (None, ""):
            parts.append(f"{key}: {value}")
    return compact(" | ".join(parts) if parts else body)


def get_action_value(actions: list[dict[str, Any]] | None, names: tuple[str, ...]) -> float:
    if not actions:
        return 0.0
    for item in actions:
        if item.get("action_type") in names:
            return to_float(item.get("value", 0))
    return 0.0


def make_ad(row: dict[str, Any]) -> dict[str, Any]:
    actions = row.get("actions", [])
    cost_actions = row.get("cost_per_action_type", [])
    spend = to_float(row.get("spend"))
    impressions = to_float(row.get("impressions"))
    clicks = to_float(row.get("inline_link_clicks"))
    purchases = get_action_value(actions, PURCHASE_ACTIONS)
    cost_per_purchase = get_action_value(cost_actions, PURCHASE_ACTIONS)
    ctr = to_float(row.get("ctr"))
    cpc = to_float(row.get("cpc")) if row.get("cpc") not in (None, "") else (spend / clicks if clicks else 0)

    decision, decision_class, meaning = classify_ad(spend, impressions, clicks, ctr, purchases)
    return {
        "ad_name": row.get("ad_name", "Unnamed ad"),
        "campaign_name": row.get("campaign_name", "-"),
        "adset_name": row.get("adset_name", "-"),
        "spend_raw": spend,
        "impressions_raw": impressions,
        "reach_raw": to_float(row.get("reach")),
        "link_clicks_raw": clicks,
        "ctr_raw": ctr,
        "cpc_raw": cpc,
        "purchases_raw": purchases,
        "cost_per_purchase_raw": cost_per_purchase,
        "spend": money(spend),
        "impressions": number(impressions),
        "reach": number(row.get("reach")),
        "link_clicks": number(clicks),
        "ctr": percent(ctr),
        "cpc": money(cpc) if cpc else "-",
        "purchases": number(purchases),
        "cost_per_purchase": money(cost_per_purchase) if cost_per_purchase else "-",
        "decision": decision,
        "decision_class": decision_class,
        "meaning": meaning,
    }


def classify_ad(spend: float, impressions: float, clicks: float, ctr: float, purchases: float) -> tuple[str, str, str]:
    if purchases > 0:
        return "Winner candidate", "positive", "Köpsignal finns, kan bli vinnare."
    if impressions < LOW_IMPRESSIONS:
        return "Too little data", "muted", "För lite data för beslut."
    if clicks >= 1 and ctr >= 2 and purchases == 0:
        return "Keep testing", "warning", "Bra klicksignal, fortsätt testa."
    if clicks >= 1 and purchases == 0:
        if ctr < 2:
            return "Weak hook", "danger", "Folk klickar lite, men hooken är svag."
        return "Check product page / offer", "warning", "Folk klickar, men ingen köper ännu."
    if spend > 0 and clicks == 0:
        return "Watch / weak signal", "danger", "Inga klick ännu, kreativ/hook behöver bevakas."
    return "Too little data", "muted", "För lite data för beslut."


def base_data(brand: str, campaign: str, diagnosis: str, mode: str) -> dict[str, Any]:
    date_preset = env("META_DATE_PRESET", "today")
    return DEFAULT_REPORT_DATA | {
        "date": now_date(),
        "updated_at": now_stamp(),
        "brand": brand,
        "campaign": campaign,
        "diagnosis": diagnosis,
        "mode": mode,
        "period": PERIOD_LABELS.get(date_preset, date_preset),
        "period_key": date_preset,
        "ads": [],
        "top_ad": None,
        "summary": "Vi får klick men inga köp ännu.",
        "recommendation": "KEEP RUNNING",
        "recommendation_sv": "Fortsätt köra och samla mer data innan beslut.",
        "creative_diagnosis": [diagnosis],
    }


def summarize_ads(ads: list[dict[str, Any]]) -> dict[str, Any]:
    spend = sum(ad["spend_raw"] for ad in ads)
    impressions = sum(ad["impressions_raw"] for ad in ads)
    reach = sum(ad["reach_raw"] for ad in ads)
    clicks = sum(ad["link_clicks_raw"] for ad in ads)
    purchases = sum(ad["purchases_raw"] for ad in ads)
    ctr = (clicks / impressions * 100) if impressions else 0
    cpc = spend / clicks if clicks else 0
    cpp_values = [ad["cost_per_purchase_raw"] for ad in ads if ad["cost_per_purchase_raw"]]
    cost_per_purchase = min(cpp_values) if cpp_values else (spend / purchases if purchases else 0)
    return {
        "spend": money(spend), "impressions": number(impressions), "reach": number(reach),
        "link_clicks": number(clicks), "ctr": percent(ctr), "cpc": money(cpc) if cpc else "-",
        "purchases": number(purchases), "cost_per_purchase": money(cost_per_purchase) if cost_per_purchase else "-",
        "roas": "-", "spend_raw": spend, "impressions_raw": impressions, "clicks_raw": clicks,
        "purchases_raw": purchases, "ctr_raw": ctr,
    }


def top_ad(ads: list[dict[str, Any]]) -> dict[str, Any] | None:
    clicked = [ad for ad in ads if ad["link_clicks_raw"] >= 1]
    return max(clicked, key=lambda ad: (ad["ctr_raw"], ad["link_clicks_raw"], -ad["spend_raw"])) if clicked else None


def build_narrative(ads: list[dict[str, Any]], totals: dict[str, Any], top: dict[str, Any] | None) -> tuple[str, list[str], str, str]:
    purchases = totals["purchases_raw"]
    clicks = totals["clicks_raw"]
    ctr = totals["ctr_raw"]
    if purchases > 0:
        summary = "Vi har köpsignal. Nu ska vi jämföra kostnad per köp innan något skalas."
    elif clicks > 0:
        summary = "Vi får klick men inga köp ännu."
    else:
        summary = "Vi har ännu ingen tydlig klick- eller köpsignal."

    strongest = top["ad_name"] if top else "ingen annons ännu"
    weakest = min(ads, key=lambda ad: (ad["purchases_raw"], ad["link_clicks_raw"], ad["ctr_raw"])) if ads else None
    weak_name = weakest["ad_name"] if weakest else "ingen annons ännu"
    diagnosis = [
        f"Starkast signal just nu: {strongest}.",
        f"Svagast signal just nu: {weak_name}.",
        "CTR verkar vara problemet: få personer klickar efter att ha sett annonsen." if ctr < 2 and purchases == 0 else "CTR är inte huvudproblemet just nu; klicksignalen finns.",
        "Eftersom klick finns men köp saknas bör produkt­sida, erbjudande, pris, förtroende och checkout kontrolleras utan att ändra något i Meta." if clicks > 0 and purchases == 0 else "Vi behöver mer trafik innan produkt­sidan kan bedömas rättvist.",
        "Förbered nya annonser i pausat läge så att nya vinklar finns redo om signalen inte förbättras." if purchases == 0 else "Skapa inte fler annonser förrän köpsignalen har analyserats.",
    ]
    if purchases > 0:
        rec, rec_sv = "KEEP RUNNING", "Fortsätt köra och bedöm om köpen håller stabil kostnad."
    elif clicks >= 1 and ctr >= 2:
        rec, rec_sv = "PREPARE NEW PAUSED CREATIVES", "Förbered nya annonser, men aktivera dem inte ännu."
    elif totals["impressions_raw"] >= LOW_IMPRESSIONS and clicks == 0:
        rec, rec_sv = "CREATE NEW PAUSED CREATIVES", "Skapa nya annonser i pausat läge eftersom nuvarande hook inte får klick."
    else:
        rec, rec_sv = "KEEP RUNNING", "Fortsätt köra lite till eftersom datan fortfarande är för liten."
    return summary, diagnosis, rec, rec_sv


def fetch_meta_data() -> dict[str, Any]:
    access_token = env("META_ACCESS_TOKEN")
    ad_account_id = env("META_AD_ACCOUNT_ID")
    api_version = env("META_API_VERSION", "v25.0")
    brand = env("REPORT_BRAND", "The Clarity Shop")
    campaign = env("REPORT_CAMPAIGN", "Sales / Purchase test")
    date_preset = env("META_DATE_PRESET", "today")

    if not access_token or not ad_account_id:
        return base_data(brand, campaign, "Missing GitHub secrets. Add META_ACCESS_TOKEN and META_AD_ACCOUNT_ID, then run the workflow again.", "Missing secrets")

    raw_ad_account_id = ad_account_id
    if not ad_account_id.startswith("act_"):
        ad_account_id = f"act_{ad_account_id}"

    fields = ["campaign_name", "adset_name", "ad_name", "spend", "impressions", "reach", "inline_link_clicks", "ctr", "cpc", "actions", "cost_per_action_type"]
    params = urllib.parse.urlencode({"fields": ",".join(fields), "date_preset": date_preset, "level": "ad", "access_token": access_token})
    url = f"https://graph.facebook.com/{api_version}/{ad_account_id}/insights?{params}"

    try:
        with urllib.request.urlopen(url, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", "replace")
        diagnosis = f"Meta API HTTP {error.code}: {parse_meta_error(body)}. API version: {api_version}. Checked ad account: {raw_ad_account_id}."
        print(diagnosis)
        return base_data(brand, campaign, diagnosis, "Meta API error")
    except urllib.error.URLError as error:
        diagnosis = f"Meta API connection error: {error}. Check network/API availability and try again."
        print(diagnosis)
        return base_data(brand, campaign, diagnosis, "Meta API connection error")
    except Exception as error:
        diagnosis = f"Unexpected live fetch error: {type(error).__name__}: {error}"
        print(diagnosis)
        return base_data(brand, campaign, diagnosis, "Meta API error")

    rows = payload.get("data", [])
    if not rows:
        return base_data(brand, campaign, "Meta API returned no ad-level rows for the selected period. The token worked, but there may be no ad data for this period.", "No Meta ad data")

    ads = [make_ad(row) for row in rows]
    totals = summarize_ads(ads)
    top = top_ad(ads)
    summary, creative_diagnosis, recommendation, recommendation_sv = build_narrative(ads, totals, top)
    campaign_name = top["campaign_name"] if top else (ads[0]["campaign_name"] if ads else campaign)
    return base_data(brand, campaign_name, "Ad-level Meta data loaded.", "Live Meta API · ad level") | totals | {
        "ads": ads, "top_ad": top, "summary": summary, "creative_diagnosis": creative_diagnosis,
        "recommendation": recommendation, "recommendation_sv": recommendation_sv,
        "period": PERIOD_LABELS.get(date_preset, date_preset), "period_key": date_preset,
    }


def render_ad_rows(ads: list[dict[str, Any]]) -> str:
    if not ads:
        return '<tr><td colspan="13">Ingen annonsdata på annonsnivå ännu.</td></tr>'
    rows = []
    for ad in ads:
        rows.append(f"""
          <tr>
            <td data-label="Ad name"><strong>{safe(ad['ad_name'])}</strong></td>
            <td data-label="Campaign">{safe(ad['campaign_name'])}</td>
            <td data-label="Ad set">{safe(ad['adset_name'])}</td>
            <td data-label="Spend">{safe(ad['spend'])}</td>
            <td data-label="Impressions">{safe(ad['impressions'])}</td>
            <td data-label="Reach">{safe(ad['reach'])}</td>
            <td data-label="Link clicks">{safe(ad['link_clicks'])}</td>
            <td data-label="CTR">{safe(ad['ctr'])}</td>
            <td data-label="CPC">{safe(ad['cpc'])}</td>
            <td data-label="Purchases">{safe(ad['purchases'])}</td>
            <td data-label="Cost / purchase">{safe(ad['cost_per_purchase'])}</td>
            <td data-label="Decision"><span class="badge {safe(ad['decision_class'])}">{safe(ad['decision'])}</span></td>
            <td data-label="Meaning">{safe(ad['meaning'])}</td>
          </tr>""")
    return "\n".join(rows)


def render_top_ad(ad: dict[str, Any] | None) -> str:
    if not ad:
        return '<div class="top-empty">No clear top ad yet.</div>'
    return f"""
      <div class="top-card">
        <div><div class="label">Top Ad Today</div><h3>{safe(ad['ad_name'])}</h3><p>{safe(ad['meaning'])}</p></div>
        <div class="top-grid">
          <span><b>Campaign</b>{safe(ad['campaign_name'])}</span><span><b>Ad set</b>{safe(ad['adset_name'])}</span>
          <span><b>Spend</b>{safe(ad['spend'])}</span><span><b>Impressions</b>{safe(ad['impressions'])}</span>
          <span><b>Link clicks</b>{safe(ad['link_clicks'])}</span><span><b>CTR</b>{safe(ad['ctr'])}</span>
          <span><b>CPC</b>{safe(ad['cpc'])}</span><span><b>Purchases</b>{safe(ad['purchases'])}</span>
        </div>
        <p class="meaning">Den här annonsen har starkast klicksignal just nu, men saknar fortfarande köpdata.</p>
      </div>"""


def render_html(data: dict[str, Any]) -> str:
    diagnosis_items = "".join(f"<li>{safe(item)}</li>" for item in data.get("creative_diagnosis", []))
    ad_rows = render_ad_rows(data.get("ads", []))
    top = render_top_ad(data.get("top_ad"))
    return f'''<!doctype html>
<html lang="sv">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#f6f1e8" />
  <title>Meta Ads Report - {safe(data['brand'])}</title>
  <style>
    :root {{ --bg:#f6f1e8; --panel:#fffaf2; --ink:#1f2933; --muted:#667085; --line:rgba(151,124,80,.24); --gold:#b99255; --danger:#b54747; --ok:#2f7d57; --warn:#c6782f; --soft:#e9dfcf; --shadow:0 18px 50px rgba(33,25,15,.10); --radius:24px; }}
    * {{ box-sizing:border-box; }} body {{ margin:0; font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; background:radial-gradient(circle at top left,rgba(200,143,143,.18),transparent 34%),radial-gradient(circle at top right,rgba(185,146,85,.20),transparent 34%),var(--bg); color:var(--ink); line-height:1.5; }}
    .wrap {{ width:min(1180px,100%); margin:0 auto; padding:24px 16px 48px; }} .hero,.section,.card {{ background:rgba(255,250,242,.92); border:1px solid var(--line); box-shadow:var(--shadow); }}
    .hero {{ border-radius:34px; padding:30px; }} .eyebrow {{ text-transform:uppercase; letter-spacing:.16em; color:var(--gold); font-size:12px; font-weight:900; margin:0 0 12px; }}
    h1,h2,h3 {{ font-family:Georgia,"Times New Roman",serif; }} h1 {{ font-size:clamp(38px,7vw,76px); line-height:.95; margin:0; }} h2 {{ font-size:32px; margin:0 0 12px; }} h3 {{ font-size:30px; margin:4px 0 8px; }}
    .sub,.note,.metric-help,.section p,.section li {{ color:var(--muted); }} .sub {{ max-width:780px; margin:18px 0 0; font-size:17px; }} .status-row {{ display:flex; flex-wrap:wrap; gap:10px; margin-top:22px; }} .pill {{ border:1px solid var(--line); background:rgba(255,255,255,.58); border-radius:999px; padding:9px 13px; color:var(--muted); font-size:13px; font-weight:800; }}
    .period-menu {{ margin-top:16px; max-width:280px; }} .period-menu summary {{ list-style:none; cursor:pointer; border:1px solid var(--line); background:#fff; border-radius:999px; padding:11px 15px; font-weight:900; box-shadow:0 8px 24px rgba(33,25,15,.06); }} .period-menu summary::-webkit-details-marker {{ display:none; }} .period-list {{ margin-top:8px; background:#fffaf2; border:1px solid var(--line); border-radius:20px; box-shadow:var(--shadow); padding:8px; display:grid; gap:6px; }} .period-list a {{ text-decoration:none; color:var(--ink); font-weight:800; padding:11px 12px; border-radius:14px; }} .period-list a:hover {{ background:rgba(185,146,85,.10); }}
    .section {{ margin-top:18px; border-radius:28px; padding:24px; }} .summary-box {{ border-left:5px solid var(--gold); }} .grid {{ display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-top:18px; }} .card {{ border-radius:var(--radius); padding:18px; }} .label {{ color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:.10em; font-weight:900; margin-bottom:8px; }} .value {{ font-size:31px; font-weight:950; letter-spacing:-.03em; }} .metric-help {{ font-size:12px; margin-top:5px; }} .red,.danger {{ color:var(--danger); font-weight:900; }} .green,.positive {{ color:var(--ok); font-weight:900; }} .warning {{ color:var(--warn); font-weight:900; }} .muted {{ color:var(--muted); font-weight:900; }}
    .top-card {{ display:grid; gap:18px; }} .top-grid {{ display:grid; grid-template-columns:repeat(4,1fr); gap:10px; }} .top-grid span {{ background:#fff; border:1px solid var(--line); border-radius:18px; padding:12px; color:var(--ink); }} .top-grid b {{ display:block; color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:.08em; margin-bottom:4px; }} .meaning,.top-empty {{ background:rgba(47,125,87,.09); border:1px solid rgba(47,125,87,.22); border-radius:18px; padding:14px; color:var(--ok); font-weight:800; }}
    .table-wrap {{ overflow-x:auto; -webkit-overflow-scrolling:touch; border:1px solid var(--line); border-radius:22px; background:#fff; }} table {{ width:100%; border-collapse:collapse; min-width:1080px; }} th,td {{ text-align:left; padding:13px 12px; border-bottom:1px solid rgba(151,124,80,.16); vertical-align:top; font-size:14px; }} th {{ background:#f4eadb; color:#5d4d39; font-size:12px; text-transform:uppercase; letter-spacing:.08em; }} .badge {{ display:inline-block; border-radius:999px; padding:7px 10px; background:rgba(102,112,133,.10); white-space:nowrap; }} .badge.positive {{ background:rgba(47,125,87,.12); }} .badge.warning {{ background:rgba(198,120,47,.14); }} .badge.danger {{ background:rgba(181,71,71,.12); }} .badge.muted {{ background:rgba(102,112,133,.12); }}
    .read-list,.diag-list {{ margin:10px 0 0; padding-left:20px; }} .action {{ text-align:center; background:linear-gradient(135deg,#fffaf2,#f3e6d2); }} .recommendation {{ display:inline-block; margin:8px 0 10px; padding:14px 22px; border-radius:999px; background:var(--ink); color:#fff; font-weight:950; letter-spacing:.08em; }} .footer {{ color:var(--muted); text-align:center; font-size:13px; padding:24px 0 0; }} a {{ color:inherit; text-decoration-color:rgba(185,146,85,.55); text-underline-offset:4px; }}
    @media (max-width:820px) {{ .wrap {{ padding:14px 12px 38px; }} .hero {{ padding:22px; border-radius:26px; }} .grid,.top-grid {{ grid-template-columns:repeat(2,1fr); }} .value {{ font-size:27px; }} h2 {{ font-size:26px; }} }}
    @media (max-width:640px) {{ table {{ min-width:0; }} thead {{ display:none; }} tr {{ display:block; padding:12px; border-bottom:1px solid var(--line); }} td {{ display:grid; grid-template-columns:126px 1fr; gap:10px; border:0; padding:8px 0; }} td::before {{ content:attr(data-label); color:var(--muted); font-size:12px; font-weight:900; text-transform:uppercase; letter-spacing:.06em; }} .top-grid,.grid {{ grid-template-columns:1fr; }} .section {{ padding:18px; }} .period-menu {{ max-width:100%; }} }}
  </style>
</head>
<body>
  <main class="wrap">
    <section class="hero">
      <p class="eyebrow">{safe(data['brand'])} · Meta Ads</p>
      <h1>Daily Performance Report</h1>
      <p class="sub">En lugn och pedagogisk daglig rapport för Lajo: vad som händer, vilka annonser som visar signal, och vilket nästa steg som är säkrast.</p>
      <details class="period-menu"><summary>Period: {safe(data['period'])} ▾</summary><nav class="period-list"><a href="latest.html">Today</a><a href="yesterday.html">Yesterday</a><a href="last_7d.html">Last 7 days</a><a href="last_14d.html">Last 14 days</a><a href="last_30d.html">Last 30 days</a><a href="this_month.html">This month</a><a href="last_month.html">Last month</a><a href="maximum.html">Maximum</a></nav></details>
      <div class="status-row"><span class="pill">Report date: {safe(data['date'])}</span><span class="pill">Updated: {safe(data['updated_at'])}</span><span class="pill">Mode: {safe(data['mode'])}</span><span class="pill">Campaign: {safe(data['campaign'])}</span></div>
    </section>

    <section class="section summary-box"><h2>Vad händer just nu?</h2><p><strong>{safe(data['summary'])}</strong> Det betyder att vi inte ska skala ännu. Nästa steg är att förstå vilken annons som får bäst respons och fortsätta samla data.</p></section>

    <section class="grid" aria-label="Meta Ads key metrics">
      <article class="card"><div class="label">Spend</div><div class="value">{safe(data['spend'])}</div><div class="note">Annonskostnad för perioden.</div></article>
      <article class="card"><div class="label">Impressions</div><div class="value">{safe(data['impressions'])}</div><div class="note">Visningar.</div></article>
      <article class="card"><div class="label">Reach</div><div class="value">{safe(data['reach'])}</div><div class="note">Unika personer.</div></article>
      <article class="card"><div class="label">Link clicks</div><div class="value red">{safe(data['link_clicks'])}</div><div class="note">Klick mot sidan.</div></article>
      <article class="card"><div class="label">CTR</div><div class="value red">{safe(data['ctr'])}</div><div class="note">Hur många som klickar efter att ha sett annonsen.</div></article>
      <article class="card"><div class="label">CPC</div><div class="value">{safe(data['cpc'])}</div><div class="note">Vad varje klick kostar.</div></article>
      <article class="card"><div class="label">Purchases</div><div class="value red">{safe(data['purchases'])}</div><div class="note">Antal köp som Meta har registrerat.</div></article>
      <article class="card"><div class="label">Cost / purchase</div><div class="value">{safe(data['cost_per_purchase'])}</div><div class="note">Kostnad per köp när köpdata finns.</div></article>
      <article class="card"><div class="label">ROAS</div><div class="value">{safe(data['roas'])}</div><div class="note">Hur mycket försäljning vi fått tillbaka jämfört med annonskostnaden.</div></article>
    </section>

    <section class="section"><h2>Top Ad Today</h2>{top}</section>

    <section class="section"><h2>Ad Performance Breakdown</h2><p class="metric-help">Tabellen visar varje annons på annonsnivå och översätter siffrorna till ett enkelt beslut.</p><div class="table-wrap"><table><thead><tr><th>Ad name</th><th>Campaign</th><th>Ad set</th><th>Spend</th><th>Impressions</th><th>Reach</th><th>Link clicks</th><th>CTR</th><th>CPC</th><th>Purchases</th><th>Cost / purchase</th><th>Decision</th><th>Meaning</th></tr></thead><tbody>{ad_rows}</tbody></table></div></section>

    <section class="section"><h2>Creative Diagnosis</h2><ul class="diag-list">{diagnosis_items}</ul></section>

    <section class="section"><h2>Så läser du rapporten</h2><ul class="read-list"><li>Hög CTR betyder att hooken eller bilden får uppmärksamhet.</li><li>Klick men inga köp kan betyda att produktsida, erbjudande, pris, förtroende eller checkout behöver kontrolleras.</li><li>Inga klick betyder ofta att creative eller hook är svag.</li><li>Köp är den starkaste signalen.</li><li>Skala inte utan köp.</li></ul></section>

    <section class="section action"><h2>Nästa steg</h2><div class="recommendation">Recommendation: {safe(data['recommendation'])}</div><p><strong>Meaning:</strong><br>{safe(data['recommendation_sv'])}</p></section>

    <p class="footer">Generated for Lajo · The Clarity Shop · <a href="archive/{safe(data['date'])}.html">Open archived report</a></p>
  </main>
</body>
</html>
'''


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    report_dir = root / "reports" / "meta-ads"
    archive_dir = report_dir / "archive"
    archive_dir.mkdir(parents=True, exist_ok=True)

    data = fetch_meta_data()
    html_output = render_html(data)
    (report_dir / "latest.html").write_text(html_output, encoding="utf-8")
    (archive_dir / f"{data['date']}.html").write_text(html_output, encoding="utf-8")

    print("Report generated:")
    print(report_dir / "latest.html")
    print(archive_dir / f"{data['date']}.html")


if __name__ == "__main__":
    main()
