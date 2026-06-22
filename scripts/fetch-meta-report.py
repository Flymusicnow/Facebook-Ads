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
    "today": "Idag",
    "yesterday": "Igår",
    "last_7d": "Senaste 7 dagarna",
    "last_14d": "Senaste 14 dagarna",
    "last_30d": "Senaste 30 dagarna",
    "this_month": "Denna månad",
    "last_month": "Förra månaden",
    "maximum": "All data",
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


def swedish_ad_status(ad: dict[str, Any]) -> tuple[str, str]:
    if ad["purchases_raw"] > 0:
        return "Vinnare", "positive"
    if ad["impressions_raw"] < 20:
        return "För lite data", "muted"
    if ad["link_clicks_raw"] > 0:
        return "Får klick", "warning"
    if ad["impressions_raw"] > 0:
        return "Svag signal", "danger"
    return "För lite data", "muted"


def status_for(kind: str, value: float) -> tuple[str, str]:
    if kind == "impressions":
        if value > 100:
            return "Bra", "positive"
        if value >= 20:
            return "Vänta", "warning"
        return "För lite data", "muted"
    if kind == "clicks":
        if value > 5:
            return "Bra", "positive"
        if value >= 1:
            return "Vänta", "warning"
        return "För lite data", "muted"
    if value > 0:
        return "Bra", "positive"
    return "Problem", "danger"


def bar_width(value: float, max_value: float) -> int:
    if max_value <= 0 or value <= 0:
        return 0
    return max(4, min(100, round(value / max_value * 100)))


def simple_meaning(totals: dict[str, Any]) -> list[str]:
    impressions = totals.get("impressions_raw", 0)
    clicks = totals.get("clicks_raw", 0)
    purchases = totals.get("purchases_raw", 0)
    return [
        "Folk ser annonserna." if impressions > 0 else "Nästan ingen ser annonserna ännu.",
        "Några klickar." if clicks > 0 else "Ingen klickar ännu.",
        "Köp har kommit in." if purchases > 0 else "Ingen har köpt ännu.",
    ]


def next_step_text(totals: dict[str, Any]) -> str:
    purchases = totals.get("purchases_raw", 0)
    clicks = totals.get("clicks_raw", 0)
    if purchases == 0 and clicks > 0:
        return "Fortsätt samla data. Förbered nya annonser, men aktivera dem inte ännu."
    if purchases > 0:
        return "Fortsätt köra. Titta om köpen fortsätter komma in."
    return "Fortsätt samla data. Vänta innan du ändrar något."


def render_status_cards(data: dict[str, Any]) -> str:
    cards = [
        ("Ser folk annonsen?", "Visningar", data["impressions"], data["impressions_raw"], "Folk ser annonserna", "impressions"),
        ("Klickar folk?", "Klick", data["link_clicks"], data["clicks_raw"], "Folk klickar", "clicks"),
        ("Köper folk?", "Köp", data["purchases"], data["purchases_raw"], "Köp har kommit in" if data["purchases_raw"] > 0 else "Inga köp ännu", "purchases"),
    ]
    html_cards = []
    for question, label, value, raw, meaning, kind in cards:
        word, cls = status_for(kind, raw)
        html_cards.append(f'''
      <article class="big-card {cls}" aria-label="{safe(question)} {safe(value)}. {safe(meaning)}. Status {safe(word)}.">
        <div class="card-top"><span>{safe(question)}</span><strong>{safe(word)}</strong></div>
        <div class="big-value">{safe(value)}</div>
        <div class="small-label">{safe(label)}</div>
        <p>{safe(meaning)}</p>
      </article>''')
    return "".join(html_cards)


def render_funnel(data: dict[str, Any]) -> str:
    items = [("Visningar", data["impressions"], data["impressions_raw"]), ("Klick", data["link_clicks"], data["clicks_raw"]), ("Köp", data["purchases"], data["purchases_raw"])]
    max_value = max([raw for _, _, raw in items] + [1])
    rows = []
    for label, display, raw in items:
        width = bar_width(raw, max_value)
        rows.append(f'''
        <div class="funnel-row">
          <div class="funnel-label"><strong>{safe(label)}</strong><span>{safe(display)}</span></div>
          <div class="bar" role="img" aria-label="{safe(label)}: {safe(display)}"><span style="width:{width}%"></span></div>
          <p class="sr-summary">{safe(label)} är {safe(display)}.</p>
        </div>''')
    return "".join(rows)


def render_top_ad(ad: dict[str, Any] | None) -> str:
    if not ad:
        return '<div class="empty-card">Ingen tydlig vinnare ännu.</div>'
    if ad["purchases_raw"] > 0:
        meaning = "Den här annonsen får bäst reaktion just nu och har köp."
    else:
        meaning = "Den här annonsen får bäst reaktion just nu, men den har fortfarande inga köp."
    return f'''
      <article class="best-card" aria-label="Bäst just nu: {safe(ad['ad_name'])}">
        <h3>{safe(ad['ad_name'])}</h3>
        <div class="mini-metrics"><span>Klick <b>{safe(ad['link_clicks'])}</b></span><span>CTR <b>{safe(ad['ctr'])}</b></span><span>Spend <b>{safe(ad['spend'])}</b></span></div>
        <p>{safe(meaning)}</p>
      </article>'''


def render_ad_cards(ads: list[dict[str, Any]]) -> str:
    if not ads:
        return '<div class="empty-card">Ingen annonsdata på annonsnivå ännu.</div>'
    max_clicks = max([ad["link_clicks_raw"] for ad in ads] + [1])
    cards = []
    for ad in ads:
        status, cls = swedish_ad_status(ad)
        width = bar_width(ad["link_clicks_raw"], max_clicks)
        cards.append(f'''
      <article class="ad-card" aria-label="Annons {safe(ad['ad_name'])}. Klick {safe(ad['link_clicks'])}. Köp {safe(ad['purchases'])}. Status {safe(status)}.">
        <div class="ad-head"><h3>{safe(ad['ad_name'])}</h3><span class="badge {cls}">{safe(status)}</span></div>
        <div class="ad-numbers"><span>Spend <b>{safe(ad['spend'])}</b></span><span>Klick <b>{safe(ad['link_clicks'])}</b></span><span>CTR <b>{safe(ad['ctr'])}</b></span><span>Köp <b>{safe(ad['purchases'])}</b></span></div>
        <div class="tiny-bar" role="img" aria-label="Klickbar för {safe(ad['ad_name'])}: {safe(ad['link_clicks'])} klick"><span style="width:{width}%"></span></div>
        <p class="sr-summary">Den här annonsen har {safe(ad['link_clicks'])} klick och status {safe(status)}.</p>
      </article>''')
    return "".join(cards)


def render_html(data: dict[str, Any]) -> str:
    status_cards = render_status_cards(data)
    funnel = render_funnel(data)
    top = render_top_ad(data.get("top_ad"))
    ad_cards = render_ad_cards(data.get("ads", []))
    meaning_items = "".join(f"<li>{safe(item)}</li>" for item in simple_meaning(data))
    next_step = next_step_text(data)
    return f'''<!doctype html>
<html lang="sv">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#f6f1e8" />
  <title>Meta Ads Kontroll - {safe(data['brand'])}</title>
  <style>
    :root {{ --bg:#f6f1e8; --panel:#fffaf2; --ink:#17202a; --muted:#52606d; --line:#d8c6aa; --green:#1f7a4d; --orange:#a85f16; --red:#a43131; --grey:#64748b; --shadow:0 16px 42px rgba(42,31,18,.10); --radius:26px; }}
    * {{ box-sizing:border-box; }} body {{ margin:0; font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; background:var(--bg); color:var(--ink); line-height:1.45; }}
    .wrap {{ width:min(980px,100%); margin:0 auto; padding:18px 14px 44px; }} .hero,.section,.big-card,.ad-card,.best-card,.empty-card,.action {{ background:var(--panel); border:1px solid var(--line); box-shadow:var(--shadow); }}
    .hero {{ border-radius:32px; padding:26px; }} h1 {{ font-size:clamp(38px,9vw,72px); line-height:1; margin:0; letter-spacing:-.05em; }} h2 {{ font-size:clamp(25px,5vw,36px); margin:0 0 14px; letter-spacing:-.03em; }} h3 {{ font-size:20px; margin:0; }}
    .sub {{ max-width:680px; color:var(--muted); font-size:19px; margin:12px 0 0; }} .pills {{ display:flex; flex-wrap:wrap; gap:10px; margin-top:18px; }} .pill {{ border:1px solid var(--line); background:#fff; border-radius:999px; padding:10px 13px; font-weight:800; color:#334155; }}
    .section {{ margin-top:18px; border-radius:28px; padding:22px; }} .cards {{ display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-top:18px; }}
    .big-card {{ border-radius:var(--radius); padding:22px; min-height:210px; border-width:3px; }} .big-card.positive {{ border-color:var(--green); }} .big-card.warning {{ border-color:var(--orange); }} .big-card.danger {{ border-color:var(--red); }} .big-card.muted {{ border-color:var(--grey); }}
    .card-top {{ display:flex; align-items:center; justify-content:space-between; gap:10px; font-size:18px; font-weight:900; }} .card-top strong,.badge {{ border-radius:999px; padding:7px 10px; color:#fff; font-size:14px; white-space:nowrap; }} .positive .card-top strong,.badge.positive {{ background:var(--green); }} .warning .card-top strong,.badge.warning {{ background:var(--orange); }} .danger .card-top strong,.badge.danger {{ background:var(--red); }} .muted .card-top strong,.badge.muted {{ background:var(--grey); }}
    .big-value {{ font-size:clamp(48px,11vw,82px); font-weight:950; letter-spacing:-.06em; margin-top:22px; }} .small-label {{ color:var(--muted); font-weight:900; text-transform:uppercase; letter-spacing:.08em; }} .big-card p,.best-card p,.ad-card p,.action p {{ color:var(--muted); font-size:17px; margin:10px 0 0; }}
    .funnel {{ display:grid; gap:16px; }} .funnel-label {{ display:flex; justify-content:space-between; gap:12px; font-size:20px; margin-bottom:8px; }} .funnel-label span {{ font-weight:950; }} .bar,.tiny-bar {{ width:100%; background:#e5ded2; border:1px solid var(--line); border-radius:999px; overflow:hidden; }} .bar {{ height:34px; }} .bar span,.tiny-bar span {{ display:block; height:100%; background:#1f7a4d; border-radius:999px; min-width:0; }} .tiny-bar {{ height:14px; margin-top:12px; }}
    .best-card,.empty-card,.action {{ border-radius:26px; padding:22px; }} .mini-metrics,.ad-numbers {{ display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-top:14px; }} .best-card .mini-metrics {{ grid-template-columns:repeat(3,1fr); }} .mini-metrics span,.ad-numbers span {{ background:#fff; border:1px solid var(--line); border-radius:18px; padding:12px; color:var(--muted); }} .mini-metrics b,.ad-numbers b {{ display:block; color:var(--ink); font-size:22px; }}
    .ad-list {{ display:grid; gap:12px; }} .ad-card {{ border-radius:24px; padding:18px; }} .ad-head {{ display:flex; align-items:flex-start; justify-content:space-between; gap:14px; }} .badge {{ border:0; font-weight:900; }}
    .meaning-list {{ margin:0; padding-left:22px; font-size:19px; }} .meaning-list li {{ margin:7px 0; }} .action {{ margin-top:18px; background:#17202a; color:#fff; text-align:center; }} .action h2,.action p {{ color:#fff; }} .action p {{ font-size:24px; font-weight:900; max-width:650px; margin:8px auto 0; }}
    .footer {{ color:var(--muted); text-align:center; font-size:14px; padding:22px 0 0; }} a {{ color:inherit; text-underline-offset:5px; }} .sr-summary {{ font-size:14px!important; }}
    @media (max-width:760px) {{ .cards,.mini-metrics,.ad-numbers,.best-card .mini-metrics {{ grid-template-columns:1fr; }} .hero,.section {{ padding:18px; border-radius:24px; }} .big-card {{ min-height:0; }} .ad-head {{ display:grid; }} .action p {{ font-size:20px; }} }}
  </style>
</head>
<body>
  <main class="wrap">
    <header class="hero">
      <h1>Meta Ads Kontroll</h1>
      <p class="sub">En enkel översikt över vad som händer med annonserna just nu.</p>
      <div class="pills" aria-label="Rapportinfo"><span class="pill">Period: {safe(data['period'])}</span><span class="pill">Campaign: {safe(data['campaign'])}</span><span class="pill">Uppdaterad: {safe(data['updated_at'])}</span></div>
    </header>

    <section class="cards" aria-label="Tre enkla frågor om annonserna">{status_cards}
    </section>

    <section class="section" aria-labelledby="funnel-title"><h2 id="funnel-title">Visningar → Klick → Köp</h2><div class="funnel">{funnel}</div></section>

    <section class="section" aria-labelledby="best-title"><h2 id="best-title">Bäst just nu</h2>{top}</section>

    <section class="section" aria-labelledby="ads-title"><h2 id="ads-title">Annonser</h2><div class="ad-list">{ad_cards}</div></section>

    <section class="section" aria-labelledby="meaning-title"><h2 id="meaning-title">Vad betyder det?</h2><ul class="meaning-list">{meaning_items}</ul></section>

    <section class="action" aria-labelledby="next-title"><h2 id="next-title">Nästa steg</h2><p>{safe(next_step)}</p></section>

    <p class="footer">Annonsnivå: campaign, ad set och ad hämtas från Meta. · <a href="archive/{safe(data['date'])}.html">Öppna arkiv</a></p>
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
