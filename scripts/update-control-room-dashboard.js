#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const REPORT_DIR = path.join("reports", "the-clarity-shop-control-room");
const ARCHIVE_DIR = path.join(REPORT_DIR, "archive");

const LAST_KNOWN_SCHEDULE = [
  ["22 June 2026 19:00", "Instagram", "@theclarityshopdigital", "Situationship Exit Strategy", "1847490", "image/png", "Keep"],
  ["22 June 2026 19:00", "Facebook", "The Clarity Shop", "Situationship Exit Strategy", "1847491", "image/png", "Keep"],
  ["22 June 2026 19:00", "TikTok", "@theclarityshop", "Situationship Exit Strategy", "1847492", "image/jpeg", "Needs video later"],
  ["23 June 2026 09:00", "Instagram", "@theclarityshopdigital", "Self-Worth Reset", "1847495", "image/png", "Edit caption later"],
  ["23 June 2026 09:00", "Facebook", "The Clarity Shop", "Self-Worth Reset", "1847500", "image/png", "Keep"],
  ["23 June 2026 09:00", "TikTok", "@theclarityshop", "Self-Worth Reset", "1847503", "image/jpeg", "Needs video later"],
  ["24 June 2026 11:00", "Instagram", "@theclarityshopdigital", "Clarity Starter Bundle", "1847505", "image/png", "Keep"],
  ["24 June 2026 11:00", "Facebook", "The Clarity Shop", "Clarity Starter Bundle", "1847506", "image/png", "Keep"],
  ["24 June 2026 11:00", "TikTok", "@theclarityshop", "Clarity Starter Bundle", "1847507", "image/jpeg", "Needs video later"],
  ["25 June 2026 11:00", "Instagram", "@theclarityshopdigital", "Full Clarity Library", "1847509", "image/png", "Edit caption later"],
  ["25 June 2026 11:00", "Facebook", "The Clarity Shop", "Full Clarity Library", "1847510", "image/png", "Edit caption later"],
  ["25 June 2026 11:00", "TikTok", "@theclarityshop", "Full Clarity Library", "1847511", "image/jpeg", "Needs video later"],
].map(([time, platform, account, product, id, mediaType, status]) => ({
  time,
  platform,
  account,
  product,
  id,
  mediaType,
  status,
}));

const PRODUCT_ORDER = [
  "Situationship Exit Strategy",
  "Self-Worth Reset",
  "Clarity Starter Bundle",
  "Full Clarity Library",
  "Money Clarity Reset",
];

const PRODUCT_PATTERNS = [
  ["Situationship Exit Strategy", ["situationship exit strategy", "situationship"]],
  ["Self-Worth Reset", ["self-worth reset", "self worth reset", "selfworth reset"]],
  ["Clarity Starter Bundle", ["clarity starter bundle", "starter bundle"]],
  ["Full Clarity Library", ["full clarity library", "six resets", "total clarity"]],
  ["Money Clarity Reset", ["money clarity reset", "money reset"]],
  ["Parenting Reset", ["parenting reset"]],
  ["Health & Wellness Reset", ["health & wellness reset", "health and wellness reset", "wellness reset"]],
  ["Career & Business Reset", ["career & business reset", "career and business reset", "career reset"]],
];

const PLATFORM_ACCOUNTS = {
  instagram: "@theclarityshopdigital",
  facebook: "The Clarity Shop",
  tiktok: "@theclarityshop",
  youtube: "YouTube Shorts",
};

const FALLBACK_META = {
  mode: "fallback",
  spend: "28,29 kr",
  linkClicks: "2",
  purchases: "0",
  ctr: "6,45%",
  cpc: "14,15 kr",
  impressions: "31",
  reach: "28",
  landingPageViews: "Saknas",
  addToCart: "0",
  bestAd: "Hook 3v2 - Kontrasten (Transformation)",
  bestAdNote: "2 klick, 7,14% CTR, 8,18 kr CPC.",
  weakestAd: "Hook 3v4 - Kanslan av lattnad (Transformation)",
  weakestAdNote: "11,58 kr spend, 1 visning, 0 klick. For lite data, men svagast spend-signal idag.",
};

const FALLBACK_SHOPIFY = {
  mode: "fallback",
  sessions: "Finns",
  cartAdditions: "Finns",
  checkoutReached: "Finns",
  completedCheckouts: "0 verifierade",
  conversionRate: "Saknas",
  deviceSplit: [
    { label: "Mobil", value: "Saknas" },
    { label: "Desktop", value: "Saknas" },
    { label: "Surfplatta", value: "Saknas" },
  ],
  socialTrafficSplit: [
    { label: "Facebook", value: "Saknas" },
    { label: "Instagram", value: "Saknas" },
    { label: "TikTok", value: "Saknas" },
  ],
  diagnostics: {
    traffic: "Ja, sessioner finns.",
    cartIntent: "Ja, add to cart finns.",
    checkoutIntent: "Ja, checkout har natts.",
    purchases: "Testkop fungerar. Inga verifierade icke-testkop annu.",
    warning: "Funneldata ar inte live annu. Bekrafta riktiga Shopify Analytics-tal innan skalning.",
  },
};

function safe(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function envValue(env, key) {
  return String(env[key] || "").trim();
}

function todayIso(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Stockholm",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now).map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function number(value) {
  const amount = Number(value || 0);
  if (Number.isNaN(amount)) return "0";
  return Number.isInteger(amount) ? amount.toLocaleString("sv-SE") : amount.toLocaleString("sv-SE", { maximumFractionDigits: 2 });
}

function money(value) {
  const amount = Number(value || 0);
  return `${amount.toLocaleString("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr`;
}

function percent(value) {
  const amount = Number(value || 0);
  return `${amount.toLocaleString("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function displayMetric(value, fallback = "Saknas") {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  if (typeof value === "number") return number(value);
  return String(value);
}

function displayPercent(value, fallback = "Saknas") {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  if (typeof value === "number") return percent(value);
  return String(value);
}

function actionValue(actions, names) {
  if (!Array.isArray(actions)) return 0;
  const item = actions.find((action) => names.includes(action.action_type));
  return Number(item?.value || 0);
}

function firstNonEmpty(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== "");
}

function nestedValue(source, paths) {
  for (const pathSpec of paths) {
    const value = pathSpec.split(".").reduce((current, key) => {
      if (current === undefined || current === null) return undefined;
      if (Array.isArray(current) && /^\d+$/.test(key)) return current[Number(key)];
      return current[key];
    }, source);
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return undefined;
}

function formatStockholmTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Stockholm",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date).map((part) => [part.type, part.value])
  );
  return `${Number(parts.day)} ${parts.month} ${parts.year} ${parts.hour}:${parts.minute}`;
}

function inferProductFocus(...values) {
  const haystack = values.filter(Boolean).join(" ").toLowerCase();
  const match = PRODUCT_PATTERNS.find(([, terms]) => terms.some((term) => haystack.includes(term)));
  return match ? match[0] : "";
}

function inferMediaType(...values) {
  const haystack = values.flat().filter(Boolean).join(" ").toLowerCase().split("?")[0];
  if (haystack.includes("video") || /\.(mp4|mov|webm|m4v)(?:$|[#?&])?/.test(haystack)) return "video";
  if (haystack.includes("image/png") || /\.png(?:$|[#?&])?/.test(haystack)) return "image/png";
  if (haystack.includes("image/jpeg") || haystack.includes("image/jpg") || /\.(jpg|jpeg)(?:$|[#?&])?/.test(haystack)) return "image/jpeg";
  if (haystack.includes("image")) return "image";
  return "";
}

function platformAccount(platform) {
  return PLATFORM_ACCOUNTS[String(platform || "").toLowerCase()] || "";
}

async function fetchMeta(env, fetchImpl) {
  const accessToken = envValue(env, "META_ACCESS_TOKEN");
  const accountId = envValue(env, "META_AD_ACCOUNT_ID");
  if (!accessToken || !accountId) {
    return { data: FALLBACK_META, status: "Meta Ads live data missing. Showing fallback values." };
  }

  const apiVersion = envValue(env, "META_API_VERSION") || "v25.0";
  const params = new URLSearchParams({
    access_token: accessToken,
    date_preset: "today",
    level: "ad",
    fields: "ad_name,campaign_name,spend,impressions,reach,inline_link_clicks,ctr,cpc,actions",
    limit: "50",
  });
  const url = `https://graph.facebook.com/${apiVersion}/act_${accountId.replace(/^act_/, "")}/insights?${params}`;

  try {
    const response = await fetchImpl(url);
    if (!response.ok) throw new Error(`Meta response ${response.status}`);
    const payload = await response.json();
    const rows = Array.isArray(payload.data) ? payload.data : [];
    if (rows.length === 0) throw new Error("Meta returned no rows");

    const totals = rows.reduce((acc, row) => {
      const spend = Number(row.spend || 0);
      const impressions = Number(row.impressions || 0);
      const reach = Number(row.reach || 0);
      const clicks = Number(row.inline_link_clicks || 0);
      const purchases = actionValue(row.actions, ["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"]);
      const addToCart = actionValue(row.actions, ["add_to_cart", "omni_add_to_cart", "offsite_conversion.fb_pixel_add_to_cart"]);
      const landingPageViews = actionValue(row.actions, ["landing_page_view"]);
      return {
        spend: acc.spend + spend,
        impressions: acc.impressions + impressions,
        reach: acc.reach + reach,
        clicks: acc.clicks + clicks,
        purchases: acc.purchases + purchases,
        addToCart: acc.addToCart + addToCart,
        landingPageViews: acc.landingPageViews + landingPageViews,
      };
    }, { spend: 0, impressions: 0, reach: 0, clicks: 0, purchases: 0, addToCart: 0, landingPageViews: 0 });

    const withMetrics = rows.map((row) => ({
      name: row.ad_name || "Unnamed ad",
      clicks: Number(row.inline_link_clicks || 0),
      ctr: Number(row.ctr || 0),
      spend: Number(row.spend || 0),
      purchases: actionValue(row.actions, ["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"]),
    }));
    const best = [...withMetrics].sort((a, b) => b.purchases - a.purchases || b.clicks - a.clicks || b.ctr - a.ctr)[0];
    const weakest = [...withMetrics].sort((a, b) => a.purchases - b.purchases || a.clicks - b.clicks || a.ctr - b.ctr || b.spend - a.spend)[0];
    const ctr = totals.impressions ? (totals.clicks / totals.impressions) * 100 : 0;
    const cpc = totals.clicks ? totals.spend / totals.clicks : 0;

    return {
      data: {
        mode: "live",
        spend: money(totals.spend),
        linkClicks: number(totals.clicks),
        purchases: number(totals.purchases),
        ctr: percent(ctr),
        cpc: cpc ? money(cpc) : "-",
        impressions: number(totals.impressions),
        reach: number(totals.reach),
        landingPageViews: totals.landingPageViews ? number(totals.landingPageViews) : "Saknas",
        addToCart: number(totals.addToCart),
        bestAd: best?.name || "Ingen tydlig vinnare",
        bestAdNote: `${number(best?.clicks || 0)} klick, ${percent(best?.ctr || 0)} CTR.`,
        weakestAd: weakest?.name || "Ingen tydlig svagast",
        weakestAdNote: "Bedoms automatiskt fran klick, CTR och kop.",
      },
      status: "Meta Ads live data loaded.",
    };
  } catch (error) {
    return { data: FALLBACK_META, status: "Meta Ads live data missing. Showing fallback values." };
  }
}

function normalizeBlotatoItem(item) {
  const platform = firstNonEmpty(item.platform, item.channel, item.network, nestedValue(item, ["account.platform"])) || "Platform saknas";
  const text = firstNonEmpty(item.text, item.caption, item.content, item.body, item.description, nestedValue(item, ["post.text", "post.caption"])) || "";
  const mediaUrls = item.mediaUrls || item.media_urls || item.media || item.assets || item.files || [];
  const mediaUrl = Array.isArray(mediaUrls) ? mediaUrls.map((media) => typeof media === "string" ? media : firstNonEmpty(media.url, media.src, media.href, media.fileUrl, media.file_url)) : mediaUrls;
  const mediaType = firstNonEmpty(
    item.mediaType,
    item.media_type,
    item.mimeType,
    item.mime_type,
    nestedValue(item, ["media.0.type", "media.0.mimeType", "assets.0.type", "assets.0.mimeType"]),
    inferMediaType(mediaUrl)
  );
  const product = firstNonEmpty(
    item.product,
    item.productFocus,
    item.product_focus,
    inferProductFocus(text, item.title, mediaUrl)
  );
  const state = firstNonEmpty(item.status, item.risk, item.riskLabel, item.risk_label, nestedValue(item, ["state.type"])) || "";
  const status = String(platform).toLowerCase().includes("tiktok") && String(mediaType).startsWith("image")
    ? "Needs video later"
    : (String(state).toLowerCase().includes("scheduled") ? "Keep" : state || "Check media");
  return {
    time: formatStockholmTime(firstNonEmpty(item.time, item.scheduledAt, item.scheduled_at, item.postTime, item.post_time, item.date)) || "Tid saknas",
    platform,
    account: firstNonEmpty(item.account, item.handle, item.pageName, item.page_name, nestedValue(item, ["account.name", "account.handle"]), platformAccount(platform)) || "",
    product: product || "Produkt saknas",
    id: String(item.id || item.postId || item.post_id || "-"),
    mediaType: mediaType || "unknown",
    status,
  };
}

async function fetchBlotato(env, fetchImpl) {
  const token = envValue(env, "BLOTATO_TOKEN");
  if (!token) {
    return {
      data: { mode: "fallback", schedule: LAST_KNOWN_SCHEDULE },
      status: "Blotato live data missing. Showing last known schedule.",
    };
  }

  const url = envValue(env, "BLOTATO_SCHEDULE_URL") || "https://backend.blotato.com/v2/posts";
  try {
    const response = await fetchImpl(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) throw new Error(`Blotato response ${response.status}`);
    const payload = await response.json();
    const rawItems = Array.isArray(payload) ? payload : payload.posts || payload.data || payload.items || [];
    if (!Array.isArray(rawItems) || rawItems.length === 0) throw new Error("Blotato returned no schedule rows");
    const scheduledItems = rawItems.filter((item) => {
      const state = String(nestedValue(item, ["state.type"]) || item.state || item.status || "").toLowerCase();
      return state ? state.includes("scheduled") : true;
    });
    if (scheduledItems.length === 0) throw new Error("Blotato returned no scheduled rows");
    return {
      data: { mode: "live", schedule: scheduledItems.map(normalizeBlotatoItem) },
      status: "Blotato live schedule loaded.",
    };
  } catch (error) {
    return {
      data: { mode: "fallback", schedule: LAST_KNOWN_SCHEDULE },
      status: "Blotato live data missing. Showing last known schedule.",
    };
  }
}

function normalizeSplit(value, fallback) {
  if (Array.isArray(value)) {
    return value.map((item) => ({
      label: displayMetric(item.label || item.name || item.source || item.device, "Okand"),
      value: displayMetric(item.value ?? item.sessions ?? item.count ?? item.percent ?? item.percentage),
    }));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).map(([label, metric]) => ({
      label,
      value: displayMetric(metric),
    }));
  }
  return fallback;
}

function normalizeShopifyFunnel(raw = {}) {
  const sessions = firstNonEmpty(raw.sessions, raw.visits);
  const cartAdditions = firstNonEmpty(raw.cartAdditions, raw.sessionsWithCartAdditions, raw.addToCart, raw.add_to_cart);
  const checkouts = firstNonEmpty(raw.checkoutReached, raw.reachedCheckout, raw.sessionsReachedCheckout, raw.checkoutsReached);
  const completed = firstNonEmpty(raw.completedCheckouts, raw.completed_checkout, raw.purchases, raw.orders);
  const conversion = firstNonEmpty(raw.conversionRate, raw.conversion_rate);
  return {
    mode: "provided",
    sessions: displayMetric(sessions),
    cartAdditions: displayMetric(cartAdditions),
    checkoutReached: displayMetric(checkouts),
    completedCheckouts: displayMetric(completed),
    conversionRate: displayPercent(conversion),
    deviceSplit: normalizeSplit(raw.deviceSplit || raw.device_split || raw.devices, FALLBACK_SHOPIFY.deviceSplit),
    socialTrafficSplit: normalizeSplit(raw.socialTrafficSplit || raw.social_traffic_split || raw.socialTraffic || raw.social, FALLBACK_SHOPIFY.socialTrafficSplit),
    diagnostics: {
      traffic: Number(sessions || 0) > 0 ? "Ja, trafik kommer in." : "Saknas eller 0 sessioner.",
      cartIntent: Number(cartAdditions || 0) > 0 ? "Ja, vissa lagger i varukorgen." : "Ingen tydlig cart-signal annu.",
      checkoutIntent: Number(checkouts || 0) > 0 ? "Ja, vissa nar checkout." : "Ingen tydlig checkout-signal annu.",
      purchases: Number(completed || 0) > 0 ? "Ja, kop finns i funneldata." : "Inga verifierade kop i funneldata.",
      warning: raw.warning || raw.funnelWarning || "Folj var kunder tappar mellan varukorg, checkout och kop.",
    },
  };
}

async function fetchShopify(env) {
  const inlineJson = envValue(env, "SHOPIFY_FUNNEL_JSON");
  const filePath = envValue(env, "SHOPIFY_FUNNEL_DATA_FILE");

  try {
    if (inlineJson) {
      return {
        data: normalizeShopifyFunnel(JSON.parse(inlineJson)),
        status: "Shopify funnel data loaded from provided JSON.",
      };
    }
    if (filePath) {
      const raw = fs.readFileSync(filePath, "utf8");
      return {
        data: normalizeShopifyFunnel(JSON.parse(raw)),
        status: "Shopify funnel data loaded from local data file.",
      };
    }
  } catch (error) {
    return {
      data: FALLBACK_SHOPIFY,
      status: "Shopify funnel data invalid or missing. Showing known signals placeholder.",
    };
  }

  return {
    data: FALLBACK_SHOPIFY,
    status: "Shopify live funnel data missing. Showing known signals placeholder.",
  };
}

function buildOrganicSummary(schedule) {
  const todayPosts = schedule.filter((item) => item.time.startsWith("22 June 2026"));
  const nextPost = schedule[0] || null;
  const nextTime = nextPost?.time || "Saknas";
  const nextGroup = schedule.filter((item) => item.time === nextTime);
  const productCounts = Object.fromEntries(PRODUCT_ORDER.map((product) => [product, 0]));
  for (const item of schedule) {
    if (productCounts[item.product] !== undefined) productCounts[item.product] += 1;
  }
  return {
    todayPosts,
    nextPost: {
      time: nextTime,
      product: nextPost?.product || "Saknas",
      platforms: nextGroup.map((item) => item.platform).join(", ") || "Saknas",
      risk: nextGroup.some((item) => item.platform.toLowerCase().includes("tiktok") && item.mediaType.startsWith("image/"))
        ? "TikTok ar stillbild"
        : "Ingen tydlig risk",
    },
    productCounts,
  };
}

async function buildControlRoomData({ env = process.env, today = todayIso(), now = new Date(), fetchImpl = globalThis.fetch } = {}) {
  const effectiveFetch = fetchImpl || globalThis.fetch;
  const [metaResult, organicResult, shopifyResult] = await Promise.all([
    fetchMeta(env, effectiveFetch),
    fetchBlotato(env, effectiveFetch),
    fetchShopify(env),
  ]);
  const organicSummary = buildOrganicSummary(organicResult.data.schedule);
  return {
    today,
    updatedAt: now.toISOString(),
    meta: metaResult.data,
    organic: { ...organicResult.data, ...organicSummary },
    shopify: shopifyResult.data,
    statusMessages: [metaResult.status, organicResult.status, shopifyResult.status],
  };
}

function badgeClass(status) {
  const normalized = String(status).toLowerCase();
  if (normalized.includes("keep")) return "keep";
  if (normalized.includes("video")) return "warn";
  if (normalized.includes("edit") || normalized.includes("missing") || normalized.includes("check")) return "check";
  return "muted";
}

function scheduleRows(schedule) {
  return schedule.map((item) => `
        <div class="schedule-item">
          <div><b>Date/time</b>${safe(item.time)}</div>
          <div><b>Platform</b>${safe(item.platform)}${item.account ? ` - ${safe(item.account)}` : ""}</div>
          <div><b>Product focus</b>${safe(item.product)}</div>
          <div><b>Media type</b>${safe(item.mediaType)}</div>
          <div><b>Post ID</b>${safe(item.id)}</div>
          <span class="badge ${badgeClass(item.status)}">${safe(item.status)}</span>
        </div>`).join("");
}

function productCards(counts) {
  const max = Math.max(1, ...Object.values(counts));
  return PRODUCT_ORDER.map((product) => {
    const count = counts[product] || 0;
    const width = count ? Math.max(8, Math.round((count / max) * 100)) : 6;
    const note = count === 0 ? "0 poster: saknar standalone-post." : `${count} poster i schemat.`;
    return `
        <article class="card product-card">
          <p class="label">${safe(product)}</p>
          <div class="bar"><span style="width:${width}%"></span></div>
          <p class="push-level">${safe(note)}</p>
        </article>`;
  }).join("");
}

function splitCards(items, className) {
  return items.map((item) => `
          <div class="${className}">
            <span>${safe(item.label)}</span>
            <strong>${safe(item.value)}</strong>
          </div>`).join("");
}

function renderDashboard(data) {
  const meta = data.meta;
  const organic = data.organic;
  const shopify = data.shopify;
  return `<!doctype html>
<html lang="sv">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#f7f1e6" />
  <title>The Clarity Shop Control Room</title>
  <style>
    :root { --cream:#f7f1e6; --panel:#fffaf1; --beige:#eadcc8; --gold:#b9965b; --sage:#6f8468; --sage-dark:#43563f; --peach:#e9b59e; --ink:#27231d; --muted:#776d60; --line:rgba(154,121,72,.25); --soft-line:rgba(154,121,72,.15); --shadow:0 18px 50px rgba(67,49,24,.10); --radius:22px; }
    * { box-sizing:border-box; }
    body { margin:0; color:var(--ink); background:linear-gradient(135deg, rgba(185,150,91,.16), transparent 30%),linear-gradient(225deg, rgba(111,132,104,.14), transparent 28%),var(--cream); font-family:Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height:1.45; }
    .wrap { width:min(1180px, 100%); margin:0 auto; padding:22px 16px 48px; }
    .hero,.card,.section,.action-card { background:rgba(255,250,241,.92); border:1px solid var(--line); box-shadow:var(--shadow); }
    .hero { display:grid; grid-template-columns:1.25fr .75fr; gap:22px; align-items:end; border-radius:30px; padding:28px; }
    .eyebrow,.label,.tiny-label { margin:0; color:var(--gold); font-size:12px; font-weight:900; letter-spacing:.12em; text-transform:uppercase; }
    h1,h2,h3 { font-family:Georgia, "Times New Roman", serif; font-weight:700; letter-spacing:0; }
    h1 { margin:8px 0 12px; font-size:clamp(42px, 7vw, 78px); line-height:.95; }
    h2 { margin:0; font-size:clamp(26px, 4vw, 38px); line-height:1.05; }
    h3 { margin:0; font-size:22px; line-height:1.15; }
    p { margin:0; }
    .sub { max-width:720px; color:var(--muted); font-size:18px; }
    .hero-note { border:1px solid var(--soft-line); border-radius:20px; padding:16px; background:#fffdf8; }
    .hero-note strong { display:block; margin-top:4px; font-size:24px; }
    .source-row,.status-row { display:flex; flex-wrap:wrap; gap:9px; margin-top:20px; }
    .pill,.badge { display:inline-flex; align-items:center; width:max-content; max-width:100%; border-radius:999px; border:1px solid var(--line); background:#fffdf8; color:var(--muted); font-size:13px; font-weight:850; padding:8px 11px; white-space:normal; }
    .badge.keep { color:var(--sage-dark); background:rgba(111,132,104,.14); border-color:rgba(111,132,104,.28); }
    .badge.check { color:#8b6225; background:rgba(185,150,91,.16); border-color:rgba(185,150,91,.30); }
    .badge.warn { color:#8a4d35; background:rgba(233,181,158,.20); border-color:rgba(233,181,158,.34); }
    .badge.muted { color:var(--muted); background:rgba(119,109,96,.10); border-color:rgba(119,109,96,.20); }
    .section { margin-top:18px; border-radius:26px; padding:22px; }
    .section-head { display:flex; align-items:flex-end; justify-content:space-between; gap:18px; margin-bottom:18px; }
    .hint { max-width:470px; color:var(--muted); font-size:15px; }
    .snapshot-grid,.signal-grid,.product-grid,.next-grid,.risk-grid { display:grid; gap:13px; }
    .snapshot-grid { grid-template-columns:repeat(6, 1fr); }
    .signal-grid { grid-template-columns:repeat(4, 1fr); }
    .product-grid { grid-template-columns:repeat(5, 1fr); }
    .next-grid,.risk-grid { grid-template-columns:repeat(4, 1fr); }
    .card { min-width:0; border-radius:var(--radius); padding:16px; }
    .value { margin-top:8px; font-size:30px; font-weight:950; line-height:1; }
    .value.small { font-size:22px; line-height:1.12; }
    .note { margin-top:8px; color:var(--muted); font-size:13px; }
    .focus-card { grid-column:span 2; background:linear-gradient(135deg, #fffaf1, rgba(111,132,104,.13)); }
    .ad-hero { display:grid; grid-template-columns:repeat(2, 1fr); gap:14px; margin-bottom:14px; }
    .ad-name { margin-top:9px; font-size:20px; font-weight:900; }
    .diagnosis { display:grid; grid-template-columns:repeat(3, 1fr); gap:13px; margin-top:14px; }
    .diagnosis .card { border-color:rgba(111,132,104,.28); background:rgba(255,253,248,.84); }
    .diagnosis strong { display:block; margin:7px 0 4px; font-size:20px; }
    .funnel-grid { display:grid; grid-template-columns:1.1fr .9fr; gap:14px; align-items:stretch; }
    .funnel-steps { display:grid; grid-template-columns:repeat(4, 1fr); gap:12px; }
    .funnel-step { min-height:150px; border-radius:20px; padding:15px; border:1px solid var(--soft-line); background:#fffdf8; }
    .funnel-step strong { display:block; margin-top:9px; font-size:26px; line-height:1; }
    .funnel-step .line { width:100%; height:8px; margin-top:18px; border-radius:999px; background:var(--beige); overflow:hidden; }
    .funnel-step .line span { display:block; height:100%; border-radius:999px; background:linear-gradient(90deg, var(--sage), var(--gold)); }
    .split-panel { display:grid; gap:10px; }
    .split-row { display:flex; justify-content:space-between; gap:10px; align-items:center; border:1px solid var(--soft-line); border-radius:16px; padding:10px 12px; background:#fffdf8; color:var(--muted); font-size:14px; }
    .split-row strong { color:var(--ink); font-size:15px; white-space:nowrap; }
    .schedule-list { display:grid; gap:10px; }
    .schedule-item { display:grid; grid-template-columns:1.15fr .85fr 1.35fr .85fr .85fr auto; gap:10px; align-items:center; border:1px solid var(--soft-line); border-radius:18px; background:#fffdf8; padding:12px; }
    .schedule-item div { min-width:0; color:var(--muted); font-size:14px; }
    .schedule-item b { display:block; color:var(--ink); font-size:15px; }
    .product-card { position:relative; overflow:hidden; min-height:156px; }
    .bar { width:100%; height:12px; margin-top:18px; border-radius:999px; overflow:hidden; border:1px solid var(--soft-line); background:var(--beige); }
    .bar span { display:block; height:100%; min-width:6px; border-radius:999px; background:linear-gradient(90deg, var(--sage), var(--gold)); }
    .push-level { margin-top:11px; color:var(--muted); font-size:14px; }
    .action-card { margin-top:18px; display:grid; grid-template-columns:1fr auto; gap:18px; align-items:center; border-radius:28px; padding:24px; background:linear-gradient(135deg, var(--sage-dark), #2d3429); color:#fffaf1; }
    .action-card h2,.action-card p,.action-card .eyebrow { color:#fffaf1; }
    .action-card p { margin-top:8px; max-width:760px; font-size:20px; font-weight:800; }
    .action-badge { border:1px solid rgba(255,250,241,.34); border-radius:999px; padding:14px 18px; font-weight:950; white-space:nowrap; background:rgba(255,250,241,.12); }
    .footer { padding:22px 0 0; color:var(--muted); text-align:center; font-size:13px; }
    a { color:inherit; text-underline-offset:4px; }
    @media (max-width:980px) { .hero,.action-card,.ad-hero,.funnel-grid { grid-template-columns:1fr; } .snapshot-grid,.signal-grid,.product-grid,.next-grid,.risk-grid,.funnel-steps { grid-template-columns:repeat(2, 1fr); } .focus-card { grid-column:span 1; } .diagnosis { grid-template-columns:1fr; } .schedule-item { grid-template-columns:1fr 1fr; } .action-badge { width:max-content; white-space:normal; } }
    @media (max-width:620px) { .wrap { padding:14px 12px 36px; } .hero,.section,.action-card { border-radius:22px; padding:18px; } .snapshot-grid,.signal-grid,.product-grid,.next-grid,.risk-grid,.schedule-item,.funnel-steps { grid-template-columns:1fr; } .section-head { display:grid; } .value { font-size:28px; } }
  </style>
</head>
<body>
  <main class="wrap">
    <header class="hero">
      <div>
        <p class="eyebrow">The Clarity Shop</p>
        <h1>Control Room</h1>
        <p class="sub">En automatisk daglig vy for beslut: annonser, organiskt schema, produktrisk och nasta trygga steg.</p>
        <div class="source-row" aria-label="Datakallor">
          <span class="pill">Datum: ${safe(data.today)}</span>
          <span class="pill">Meta Ads: ${meta.mode === "live" ? "live data" : "fallback"}</span>
          <span class="pill">Blotato: ${organic.mode === "live" ? "live data" : "last known schedule"}</span>
          <span class="pill">Shopify: ${shopify.mode === "fallback" ? "placeholder" : "provided funnel data"}</span>
        </div>
        <div class="status-row">${data.statusMessages.map((message) => `<span class="pill">${safe(message)}</span>`).join("")}</div>
      </div>
      <aside class="hero-note" aria-label="Dagens enkla slutsats">
        <p class="tiny-label">Dagens enkla slutsats</p>
        <strong>${organic.mode === "live" ? "Schemat ar uppdaterat fran live-data." : "Schema visas fran senaste kanda data."}</strong>
        <p class="note">TikTok-stillbilder bor ersattas med korta videos nar videoassets ar bekraftade.</p>
      </aside>
    </header>

    <section class="section" aria-labelledby="snapshot-title">
      <div class="section-head"><div><p class="eyebrow">1. Today Snapshot</p><h2 id="snapshot-title">Idag i korthet</h2></div><p class="hint">Snabb vy for dagliga beslut.</p></div>
      <div class="snapshot-grid">
        <article class="card"><p class="label">Ad spend today</p><div class="value">${safe(meta.spend)}</div><p class="note">Meta Ads idag.</p></article>
        <article class="card"><p class="label">Link clicks today</p><div class="value">${safe(meta.linkClicks)}</div><p class="note">Klick till sidan.</p></article>
        <article class="card"><p class="label">Purchases today</p><div class="value">${safe(meta.purchases)}</div><p class="note">Kop registrerade.</p></article>
        <article class="card"><p class="label">Scheduled posts today</p><div class="value">${safe(organic.todayPosts.length)}</div><p class="note">Organiska poster idag.</p></article>
        <article class="card"><p class="label">Next post time</p><div class="value small">${safe(organic.nextPost.time)}</div><p class="note">Nasta organiska publicering.</p></article>
        <article class="card focus-card"><p class="label">Main product focus</p><div class="value small">${safe(organic.nextPost.product)}</div><p class="note">Nasta produktfokus.</p></article>
      </div>
    </section>

    <section class="section" aria-labelledby="ads-signal-title">
      <div class="section-head"><div><p class="eyebrow">2. Ads Signal</p><h2 id="ads-signal-title">Annonslaget just nu</h2></div><p class="hint">Lattlast signal fran Meta. Generatorn andrar inga annonser.</p></div>
      <div class="ad-hero">
        <article class="card"><span class="badge keep">Best ad right now</span><p class="ad-name">${safe(meta.bestAd)}</p><p class="note">${safe(meta.bestAdNote)}</p></article>
        <article class="card"><span class="badge warn">Weakest ad right now</span><p class="ad-name">${safe(meta.weakestAd)}</p><p class="note">${safe(meta.weakestAdNote)}</p></article>
      </div>
      <div class="signal-grid">
        <article class="card"><p class="label">CTR</p><div class="value">${safe(meta.ctr)}</div><p class="note">Klicksignal.</p></article>
        <article class="card"><p class="label">CPC</p><div class="value">${safe(meta.cpc)}</div><p class="note">Kostnad per klick.</p></article>
        <article class="card"><p class="label">Landing page views</p><div class="value small">${safe(meta.landingPageViews)}</div><p class="note">Fran Meta om tillgangligt.</p></article>
        <article class="card"><p class="label">Add to cart</p><div class="value">${safe(meta.addToCart)}</div><p class="note">ATC-signal.</p></article>
        <article class="card"><p class="label">Purchases</p><div class="value">${safe(meta.purchases)}</div><p class="note">Kop.</p></article>
        <article class="card"><p class="label">Spend</p><div class="value">${safe(meta.spend)}</div><p class="note">Dagens annonskostnad.</p></article>
        <article class="card"><p class="label">Impressions</p><div class="value">${safe(meta.impressions)}</div><p class="note">Folk ser annonserna.</p></article>
        <article class="card"><p class="label">Reach</p><div class="value">${safe(meta.reach)}</div><p class="note">Unika personer.</p></article>
      </div>
      <div class="diagnosis" aria-label="Enkel diagnos">
        <article class="card"><p class="label">People are seeing</p><strong>${Number(String(meta.impressions).replace(/\D/g, "")) > 0 ? "Ja" : "Inte an"}</strong><p class="note">Visningar visar om Meta levererar.</p></article>
        <article class="card"><p class="label">People are clicking</p><strong>${Number(String(meta.linkClicks).replace(/\D/g, "")) > 0 ? "Ja" : "Inte an"}</strong><p class="note">Klick visar om budskapet vacker intresse.</p></article>
        <article class="card"><p class="label">People are buying / not buying</p><strong>${Number(String(meta.purchases).replace(/\D/g, "")) > 0 ? "Ja" : "Inte an"}</strong><p class="note">Skala inte utan kop eller tydlig checkout-kontroll.</p></article>
      </div>
    </section>

    <section class="section" aria-labelledby="shopify-funnel-title">
      <div class="section-head"><div><p class="eyebrow">3. Shopify Funnel</p><h2 id="shopify-funnel-title">Var tappar kunderna?</h2></div><p class="hint">Rapportvy endast. Inga Shopify-produkter, priser eller checkout-installningar andras.</p></div>
      <div class="funnel-grid">
        <div class="funnel-steps">
          <article class="funnel-step"><p class="label">Traffic arriving</p><strong>${safe(shopify.sessions)}</strong><p class="note">Sessions</p><div class="line"><span style="width:100%"></span></div></article>
          <article class="funnel-step"><p class="label">Cart intent</p><strong>${safe(shopify.cartAdditions)}</strong><p class="note">Sessions with cart additions</p><div class="line"><span style="width:72%"></span></div></article>
          <article class="funnel-step"><p class="label">Checkout intent</p><strong>${safe(shopify.checkoutReached)}</strong><p class="note">Reached checkout</p><div class="line"><span style="width:48%"></span></div></article>
          <article class="funnel-step"><p class="label">Purchases</p><strong>${safe(shopify.completedCheckouts)}</strong><p class="note">Completed checkout</p><div class="line"><span style="width:18%"></span></div></article>
        </div>
        <article class="card">
          <span class="badge ${shopify.mode === "fallback" ? "check" : "keep"}">Funnel warning</span>
          <p class="value small">${safe(shopify.conversionRate)}</p>
          <p class="note">Conversion rate</p>
          <div class="diagnosis" style="grid-template-columns:1fr; margin-top:13px;">
            <div class="card"><p class="label">Kort diagnos</p><p class="note">${safe(shopify.diagnostics.traffic)} ${safe(shopify.diagnostics.cartIntent)} ${safe(shopify.diagnostics.checkoutIntent)} ${safe(shopify.diagnostics.purchases)}</p></div>
            <div class="card"><p class="label">Varning</p><p class="note">${safe(shopify.diagnostics.warning)}</p></div>
          </div>
        </article>
      </div>
      <div class="next-grid" style="margin-top:13px;">
        <article class="card"><p class="label">Device split</p><div class="split-panel">${splitCards(shopify.deviceSplit, "split-row")}</div></article>
        <article class="card"><p class="label">Social traffic split</p><div class="split-panel">${splitCards(shopify.socialTrafficSplit, "split-row")}</div></article>
        <article class="card"><p class="label">Vad betyder det?</p><div class="value small">Se hela vagen</div><p class="note">Om klick finns men kop saknas: kontrollera produktvy, varukorg och checkout innan skalning.</p></article>
        <article class="card"><p class="label">Data source</p><div class="value small">${shopify.mode === "fallback" ? "Placeholder" : "Provided"}</div><p class="note">${shopify.mode === "fallback" ? "Live Shopify funnel saknas i repot." : "Funneldata lastes fran konfigurerad kallfil/JSON."}</p></article>
      </div>
    </section>

    <section class="section" aria-labelledby="next-post-title">
      <div class="section-head"><div><p class="eyebrow">4. Today / Next Post</p><h2 id="next-post-title">Nasta schemalagda post</h2></div><p class="hint">Visar vad som hander harnast i organiskt schema.</p></div>
      <div class="next-grid">
        <article class="card"><p class="label">Next scheduled post time</p><div class="value small">${safe(organic.nextPost.time)}</div><p class="note">Nasta tid i schemat.</p></article>
        <article class="card"><p class="label">Next product focus</p><div class="value small">${safe(organic.nextPost.product)}</div><p class="note">Produkt som pushas harnast.</p></article>
        <article class="card"><p class="label">Platforms posting next</p><div class="value small">${safe(organic.nextPost.platforms)}</div><p class="note">Plattformar vid samma tid.</p></article>
        <article class="card"><p class="label">Risk note</p><div class="value small">${safe(organic.nextPost.risk)}</div><p class="note">TikTok med stillbild bor bli video senare.</p></article>
      </div>
    </section>

    <section class="section" aria-labelledby="organic-title">
      <div class="section-head"><div><p class="eyebrow">5. Organic Schedule</p><h2 id="organic-title">Organiskt schema</h2></div><p class="hint">Generatorn visar schemat men postar eller schemalagger inget.</p></div>
      <div class="schedule-list">${scheduleRows(organic.schedule)}
      </div>
    </section>

    <section class="section" aria-labelledby="risk-title">
      <div class="section-head"><div><p class="eyebrow">6. Organic Risk Summary</p><h2 id="risk-title">Organiska risker</h2></div><p class="hint">En lugn checklista for forbattrringar.</p></div>
      <div class="risk-grid">
        <article class="card"><span class="badge warn">Needs video</span><p class="value small">TikTok stillbilder</p><p class="note">TikTok-poster med stillbild behover kort video senare.</p></article>
        <article class="card"><span class="badge check">Missing YouTube</span><p class="value small">YouTube Shorts saknas</p><p class="note">Lagg till nar videoformat ar bekraftat.</p></article>
        <article class="card"><span class="badge check">Product gap</span><p class="value small">Money Clarity Reset saknas</p><p class="note">Ingen standalone-post finns i schemat annu.</p></article>
        <article class="card"><span class="badge keep">Calmer</span><p class="value small">23 June ar lugnare</p><p class="note">Schemat ar jamnare efter reschedule.</p></article>
      </div>
    </section>

    <section class="section" aria-labelledby="product-push-title">
      <div class="section-head"><div><p class="eyebrow">7. Product Push Map</p><h2 id="product-push-title">Vad pushas mest?</h2></div><p class="hint">Raknar schemalagda organiska poster per produkt.</p></div>
      <div class="product-grid">${productCards(organic.productCounts)}
      </div>
    </section>

    <section class="action-card" aria-labelledby="next-action-title">
      <div><p class="eyebrow">8. Next Best Action</p><h2 id="next-action-title">Keep the current schedule.</h2><p>Next improvement: replace TikTok still images with short videos and add a standalone Money Clarity Reset post after video assets are confirmed. Do not scale ads hard until Shopify funnel shows real purchase signal.</p></div>
      <div class="action-badge">Keep schedule</div>
    </section>

    <p class="footer">Generated automatically for The Clarity Shop at ${safe(data.updatedAt)}. Archive: <a href="archive/${safe(data.today)}.html">${safe(data.today)}</a>. Inga Meta Ads, Shopify-installningar, Blotato-poster eller Drive-filer andrades.</p>
  </main>
</body>
</html>
`;
}

function writeDashboard(html, { outputRoot = REPORT_DIR, today = todayIso() } = {}) {
  const archiveDir = path.join(outputRoot, "archive");
  fs.mkdirSync(archiveDir, { recursive: true });
  const latestPath = path.join(outputRoot, "latest.html");
  const archivePath = path.join(archiveDir, `${today}.html`);
  fs.writeFileSync(latestPath, html);
  fs.writeFileSync(archivePath, html);
  return { latestPath, archivePath };
}

async function main() {
  const today = todayIso();
  const data = await buildControlRoomData({ today });
  const html = renderDashboard(data);
  const written = writeDashboard(html, { today });
  for (const message of data.statusMessages) {
    console.log(message);
  }
  console.log(`Wrote ${written.latestPath}`);
  console.log(`Wrote ${written.archivePath}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  buildControlRoomData,
  renderDashboard,
  writeDashboard,
};
