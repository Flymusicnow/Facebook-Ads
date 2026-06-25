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
  weakestAdNote: "11,58 kr spend, 1 visning, 0 klick. För lite data, men svagast spend-signal idag.",
};

const FALLBACK_SHOPIFY = {
  mode: "fallback",
  sourceLabel: "Manual 7-day Shopify Analytics snapshot",
  sessions: "183",
  cartAdditions: "7",
  checkoutReached: "12",
  completedCheckouts: "2",
  conversionRate: "ca 1,09%",
  socialSessions: "32",
  deviceSplit: [
    { label: "Desktop", value: "115" },
    { label: "Mobile", value: "68" },
  ],
  socialTrafficSplit: [
    { label: "Facebook", value: "26" },
    { label: "Instagram", value: "6" },
    { label: "TikTok", value: "Saknas" },
  ],
  diagnostics: {
    traffic: "Trafik kommer in: 183 sessioner senaste 7 dagarna.",
    cartIntent: "Cart intent finns, men är relativt låg: 7 sessioner med cart additions.",
    checkoutIntent: "Checkout intent finns: 12 sessioner nådde checkout.",
    purchases: "2 completed checkouts syns i Shopify Analytics.",
    warning: "Completed checkout kan innehålla testköp. Räkna dem inte som bekräftade riktiga kundköp innan orderkälla och kundtyp är verifierade.",
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
    socialSessions: displayMetric(raw.socialSessions || raw.social_sessions),
    sourceLabel: raw.sourceLabel || raw.source_label || "Provided Shopify funnel data",
    deviceSplit: normalizeSplit(raw.deviceSplit || raw.device_split || raw.devices, FALLBACK_SHOPIFY.deviceSplit),
    socialTrafficSplit: normalizeSplit(raw.socialTrafficSplit || raw.social_traffic_split || raw.socialTraffic || raw.social, FALLBACK_SHOPIFY.socialTrafficSplit),
    diagnostics: {
      traffic: Number(sessions || 0) > 0 ? "Ja, trafik kommer in." : "Saknas eller 0 sessioner.",
      cartIntent: Number(cartAdditions || 0) > 0 ? "Ja, vissa lagger i varukorgen." : "Ingen tydlig cart-signal annu.",
      checkoutIntent: Number(checkouts || 0) > 0 ? "Ja, vissa nar checkout." : "Ingen tydlig checkout-signal annu.",
      purchases: Number(completed || 0) > 0 ? "Ja, kop finns i funneldata." : "Inga verifierade kop i funneldata.",
      warning: raw.warning || raw.funnelWarning || "Följ var kunder tappar mellan varukorg, checkout och köp.",
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
    status: "Shopify live funnel data missing. Showing manual 7-day Shopify Analytics snapshot.",
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

function parsedNumber(value) {
  const normalized = String(value ?? "").replace(/\s/g, "").replace(",", ".");
  const match = normalized.match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function dataSourceLabel(resultMode, liveLabel, fallbackLabel) {
  return resultMode === "live" || resultMode === "provided" ? liveLabel : fallbackLabel;
}

function actionQueue() {
  return [
    "Skapa Blotato AI-video-preview",
    "Låt ads fortsätta samla data",
    "Kontrollera funnel igen imorgon",
    "Skapa “What’s inside” content",
    "Retargeting senare när mer data finns",
  ];
}

function actionQueueMarkup() {
  return actionQueue().map((item, index) => `
          <li><span>${index + 1}</span><strong>${safe(item)}</strong></li>`).join("");
}

function sourcePills(data, meta, organic, shopify) {
  const pills = [
    `Datum: ${data.today}`,
    `Meta Ads: ${dataSourceLabel(meta.mode, "live data", "fallback")}`,
    `Blotato: ${dataSourceLabel(organic.mode, "live data", "senaste kända schema")}`,
    `Shopify: ${shopify.mode === "provided" ? "provided funnel data" : "manuell 7-dagars snapshot"}`,
  ];
  return pills.map((pill) => `<span class="pill">${safe(pill)}</span>`).join("");
}

function renderDashboard(data) {
  const meta = data.meta;
  const organic = data.organic;
  const shopify = data.shopify;
  const linkClicks = parsedNumber(meta.linkClicks);
  const purchases = parsedNumber(meta.purchases);
  const landingPageViews = parsedNumber(meta.landingPageViews);
  const addToCart = parsedNumber(meta.addToCart);
  const completedCheckouts = parsedNumber(shopify.completedCheckouts);
  const tiktokNeedsVideo = organic.schedule.some((item) => String(item.platform).toLowerCase().includes("tiktok") && String(item.mediaType).startsWith("image"));
  const adsStatus = linkClicks > 0 ? "Fortsätt samla data" : "Bevaka klick";
  const funnelStatus = completedCheckouts > 0 ? "Trafik finns, köp ej bekräftade" : "Funnel behöver signal";
  const nextOrganicAction = tiktokNeedsVideo ? "Skapa Blotato-video" : "Behåll schemat";
  const adDecisionNote = linkClicks > 0
    ? "För lite data för att stoppa annonser ännu."
    : "Stoppa/pausa endast om spend fortsätter utan klick eller funnel-signal.";
  return `<!doctype html>
<html lang="sv">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#f7f1e6" />
  <title>The Clarity Shop Control Room</title>
  <style>
    :root { --cream:#f7f1e6; --panel:#fffaf1; --beige:#eadcc8; --gold:#b9965b; --sage:#6f8468; --sage-dark:#43563f; --yellow:#d8b25f; --red:#b87561; --peach:#e9b59e; --ink:#27231d; --muted:#776d60; --line:rgba(154,121,72,.25); --soft-line:rgba(154,121,72,.15); --shadow:0 16px 42px rgba(67,49,24,.10); --radius:20px; }
    * { box-sizing:border-box; }
    html,body { width:100%; max-width:100%; overflow-x:hidden; }
    body { margin:0; color:var(--ink); background:linear-gradient(135deg, rgba(185,150,91,.16), transparent 30%),linear-gradient(225deg, rgba(111,132,104,.14), transparent 28%),var(--cream); font-family:Inter, Atkinson Hyperlegible, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height:1.5; }
    .wrap { width:min(1120px, 100%); max-width:100%; margin:0 auto; padding:14px 10px 34px; }
    .hero,.card,.section,.decision-card,.queue-card { width:100%; max-width:100%; background:rgba(255,250,241,.94); border:1px solid var(--line); box-shadow:var(--shadow); }
    .hero { border-radius:24px; padding:18px; }
    .eyebrow,.label,.tiny-label { margin:0; color:var(--gold); font-size:12px; font-weight:900; letter-spacing:.08em; text-transform:uppercase; overflow-wrap:anywhere; }
    h1,h2,h3 { font-family:Georgia, "Times New Roman", serif; font-weight:700; letter-spacing:0; }
    h1 { margin:8px 0 10px; font-size:clamp(36px, 11vw, 72px); line-height:.98; overflow-wrap:anywhere; }
    h2 { margin:0; font-size:clamp(24px, 7vw, 36px); line-height:1.08; }
    h3 { margin:0; font-size:21px; line-height:1.16; }
    p,li,span,strong { overflow-wrap:anywhere; }
    p { margin:0; }
    .sub { max-width:760px; color:var(--muted); font-size:18px; }
    .source-row,.status-row,.period-tabs { display:flex; flex-wrap:wrap; gap:8px; margin-top:16px; max-width:100%; }
    .pill,.badge,.period-tab { display:inline-flex; align-items:center; max-width:100%; min-width:0; border-radius:999px; border:1px solid var(--line); background:#fffdf8; color:var(--muted); font-size:13px; font-weight:850; padding:8px 10px; white-space:normal; overflow-wrap:anywhere; }
    .period-tab.active { color:var(--sage-dark); background:rgba(111,132,104,.16); border-color:rgba(111,132,104,.32); }
    .period-tab.muted { background:rgba(234,220,200,.45); color:var(--muted); }
    .badge.keep { color:var(--sage-dark); background:rgba(111,132,104,.14); border-color:rgba(111,132,104,.28); }
    .badge.check { color:#8b6225; background:rgba(185,150,91,.16); border-color:rgba(185,150,91,.30); }
    .badge.warn { color:#8a4d35; background:rgba(233,181,158,.20); border-color:rgba(233,181,158,.34); }
    .badge.muted { color:var(--muted); background:rgba(119,109,96,.10); border-color:rgba(119,109,96,.20); }
    .section { margin-top:14px; border-radius:22px; padding:16px; }
    .section-head { display:grid; gap:8px; margin-bottom:14px; }
    .hint { color:var(--muted); font-size:15px; }
    .grid,.decision-row,.metric-grid,.shopify-grid,.organic-grid,.ad-grid { display:grid; grid-template-columns:1fr; gap:10px; }
    .card,.decision-card,.queue-card { min-width:0; border-radius:var(--radius); padding:14px; }
    .decision-card { position:relative; overflow:hidden; min-height:130px; }
    .decision-card.ok { border-color:rgba(111,132,104,.32); background:linear-gradient(135deg, rgba(111,132,104,.16), #fffaf1); }
    .decision-card.watch { border-color:rgba(216,178,95,.36); background:linear-gradient(135deg, rgba(216,178,95,.18), #fffaf1); }
    .decision-card.stop { border-color:rgba(184,117,97,.34); background:linear-gradient(135deg, rgba(184,117,97,.16), #fffaf1); }
    .decision-card strong { display:block; margin-top:8px; font-size:24px; line-height:1.08; }
    .value { margin-top:8px; font-size:32px; font-weight:950; line-height:1; }
    .value.small { font-size:22px; line-height:1.14; }
    .note { margin-top:8px; color:var(--muted); font-size:14px; }
    .queue-list { list-style:none; padding:0; margin:12px 0 0; display:grid; gap:8px; }
    .queue-list li { display:grid; grid-template-columns:32px 1fr; gap:10px; align-items:center; border:1px solid var(--soft-line); border-radius:16px; padding:9px 10px; background:#fffdf8; }
    .queue-list li span { display:grid; place-items:center; width:28px; height:28px; border-radius:999px; background:rgba(185,150,91,.16); color:#7a5a2b; font-weight:950; }
    .funnel-stack { display:grid; gap:8px; }
    .funnel-step { display:grid; grid-template-columns:36px minmax(0, 1fr); gap:10px; align-items:center; border:1px solid var(--soft-line); border-radius:18px; padding:12px; background:#fffdf8; }
    .funnel-step .badge { grid-column:2; }
    .funnel-icon { display:grid; place-items:center; width:36px; height:36px; border-radius:999px; background:rgba(111,132,104,.14); color:var(--sage-dark); font-weight:950; }
    .funnel-step strong { font-size:20px; }
    .arrow { text-align:center; color:var(--gold); font-weight:950; line-height:1; }
    .mini-bars { display:grid; gap:10px; margin-top:10px; }
    .bar-row { display:grid; gap:6px; }
    .bar-row .top { display:flex; justify-content:space-between; gap:8px; color:var(--muted); font-size:14px; }
    .bar { width:100%; height:12px; margin-top:18px; border-radius:999px; overflow:hidden; border:1px solid var(--soft-line); background:var(--beige); }
    .bar span { display:block; height:100%; min-width:6px; border-radius:999px; background:linear-gradient(90deg, var(--sage), var(--gold)); }
    .split-panel { display:grid; gap:8px; margin-top:10px; }
    .split-row { display:flex; justify-content:space-between; gap:10px; align-items:center; border:1px solid var(--soft-line); border-radius:14px; padding:9px 10px; background:#fffdf8; color:var(--muted); font-size:14px; }
    .split-row strong { color:var(--ink); font-size:15px; white-space:normal; }
    .schedule-list { display:grid; gap:8px; }
    .schedule-item { display:grid; gap:8px; border:1px solid var(--soft-line); border-radius:16px; background:#fffdf8; padding:12px; }
    .schedule-item div { min-width:0; color:var(--muted); font-size:14px; }
    .schedule-item b { display:block; color:var(--ink); font-size:15px; }
    .compact-schedule .schedule-item:nth-child(n+7) { display:none; }
    .footer { padding:22px 0 0; color:var(--muted); text-align:center; font-size:13px; }
    a { color:inherit; text-underline-offset:4px; }
    @media (min-width:680px) { .wrap { padding:22px 16px 48px; } .hero,.section { padding:22px; } .decision-row { grid-template-columns:repeat(3, minmax(0, 1fr)); } .metric-grid,.shopify-grid,.organic-grid,.ad-grid { grid-template-columns:repeat(2, minmax(0, 1fr)); } .section-head { grid-template-columns:1fr auto; align-items:end; } .funnel-step { grid-template-columns:42px minmax(0, 1fr) auto; } .funnel-step .badge { grid-column:auto; } .schedule-item { grid-template-columns:1.1fr .9fr 1.2fr .8fr .8fr auto; align-items:center; } }
    @media (min-width:1040px) { .metric-grid { grid-template-columns:repeat(4, minmax(0, 1fr)); } .shopify-grid,.organic-grid,.ad-grid { grid-template-columns:repeat(4, minmax(0, 1fr)); } .funnel-step { grid-template-columns:48px 1fr auto; } }
  </style>
</head>
<body>
  <main class="wrap">
    <header class="hero">
      <p class="eyebrow">The Clarity Shop</p>
      <h1>The Clarity Shop Control Room</h1>
      <p class="sub">Daglig beslutsvy för annonser, organisk trafik, Shopify-funnel och nästa steg.</p>
      <nav class="period-tabs" aria-label="Perioder">
        <span class="period-tab active">Idag</span>
        <span class="period-tab">7 dagar</span>
        <span class="period-tab muted">30 dagar - kommer senare</span>
        <span class="period-tab muted">Totalt - saknas</span>
      </nav>
      <div class="source-row" aria-label="Datakällor">${sourcePills(data, meta, organic, shopify)}
      </div>
        <div class="status-row">${data.statusMessages.map((message) => `<span class="pill">${safe(message)}</span>`).join("")}</div>
    </header>

    <section class="section" aria-labelledby="decision-title">
      <div class="section-head"><div><p class="eyebrow">Beslut först</p><h2 id="decision-title">Vad ska jag göra idag?</h2></div><p class="hint">Skanna dessa tre kort först. Resten är stöddata.</p></div>
      <div class="decision-row">
        <article class="decision-card ok"><p class="label">Ads status</p><strong>${safe(adsStatus)}</strong><p class="note">${safe(adDecisionNote)}</p></article>
        <article class="decision-card watch"><p class="label">Funnel status</p><strong>${safe(funnelStatus)}</strong><p class="note">Completed checkout kan innehålla testköp.</p></article>
        <article class="decision-card watch"><p class="label">Next best action</p><strong>${safe(nextOrganicAction)}</strong><p class="note">Gör nästa kreativa förbättring, inte en stor budgetändring.</p></article>
      </div>
    </section>

    <section class="section" aria-labelledby="queue-title">
      <div class="section-head"><div><p class="eyebrow">Prioritet</p><h2 id="queue-title">Next Action Queue</h2></div><p class="hint">Kort lista. Inget annat behöver göras först.</p></div>
      <ol class="queue-list">${actionQueueMarkup()}
      </ol>
    </section>

    <section class="section" aria-labelledby="budget-title">
      <div class="section-head"><div><p class="eyebrow">Budget & Spend</p><h2 id="budget-title">Budget & Spend</h2></div><p class="hint">Tydlig periodmärkning. Saknade perioder fejkas inte.</p></div>
      <div class="metric-grid">
        <article class="card"><p class="label">Spend today</p><div class="value">${safe(meta.spend)}</div><p class="note">Meta Ads - Idag.</p></article>
        <article class="card"><p class="label">Spend last 7 days</p><div class="value small">kommer senare</div><p class="note">Behöver läggas till från Meta insights.</p></article>
        <article class="card"><p class="label">Spend total / campaign total</p><div class="value small">saknas</div><p class="note">Total spend saknas - behöver läggas till från Meta campaign insights.</p></article>
        <article class="card"><p class="label">Remaining budget</p><div class="value small">saknas</div><p class="note">Kräver konfigurerad budget.</p></article>
        <article class="card"><p class="label">CPC</p><div class="value">${safe(meta.cpc)}</div><p class="note">Idag.</p></article>
        <article class="card"><p class="label">CTR</p><div class="value">${safe(meta.ctr)}</div><p class="note">Idag.</p></article>
        <article class="card"><p class="label">Purchases</p><div class="value">${safe(meta.purchases)}</div><p class="note">Meta Ads idag.</p></article>
        <article class="card"><p class="label">Cost per purchase</p><div class="value small">${purchases > 0 ? safe(meta.spend) : "saknas"}</div><p class="note">${purchases > 0 ? "Beräknas när köp finns." : "Inga köp idag."}</p></article>
      </div>
    </section>

    <section class="section" aria-labelledby="visual-funnel-title">
      <div class="section-head"><div><p class="eyebrow">Visual Funnel</p><h2 id="visual-funnel-title">Från annons till checkout</h2></div><p class="hint">Blandar dagens Meta-signal med 7-dagars Shopify snapshot där live-data saknas.</p></div>
      <div class="funnel-stack">
        <article class="funnel-step"><span class="funnel-icon">1</span><div><p class="label">Meta Ads</p><strong>${safe(meta.linkClicks)} klick idag</strong><p class="note">Folk klickar om siffran är över 0.</p></div><span class="badge keep">Idag</span></article>
        <div class="arrow">↓</div>
        <article class="funnel-step"><span class="funnel-icon">2</span><div><p class="label">Landing Page Views</p><strong>${safe(meta.landingPageViews)}</strong><p class="note">${landingPageViews > 0 ? `${safe(meta.landingPageViews)} landing page view idag.` : "Landing page view saknas eller är 0 idag."}</p></div><span class="badge check">Idag</span></article>
        <div class="arrow">↓</div>
        <article class="funnel-step"><span class="funnel-icon">3</span><div><p class="label">Add to Cart</p><strong>${safe(meta.addToCart)}</strong><p class="note">${addToCart > 0 ? "Cart intent finns idag." : "0 add to cart idag."}</p></div><span class="badge check">Idag</span></article>
        <div class="arrow">↓</div>
        <article class="funnel-step"><span class="funnel-icon">4</span><div><p class="label">Checkout Reached</p><strong>${safe(shopify.checkoutReached)}</strong><p class="note">Shopify snapshot senaste 7 dagar.</p></div><span class="badge muted">7 dagar</span></article>
        <div class="arrow">↓</div>
        <article class="funnel-step"><span class="funnel-icon">5</span><div><p class="label">Completed Checkout</p><strong>${safe(shopify.completedCheckouts)}</strong><p class="note">${safe(shopify.completedCheckouts)} completed checkouts senaste 7 dagar - kan innehålla testköp.</p></div><span class="badge warn">Varning</span></article>
      </div>
    </section>

    <section class="section" aria-labelledby="shopify-funnel-title">
      <div class="section-head"><div><p class="eyebrow">Shopify Funnel</p><h2 id="shopify-funnel-title">Shopify: manuell 7-dagars snapshot</h2></div><p class="hint">Completed checkout kan innehålla testköp.</p></div>
      <div class="shopify-grid">
        <article class="card"><p class="label">Sessions</p><div class="value">${safe(shopify.sessions)}</div><p class="note">7 dagar.</p></article>
        <article class="card"><p class="label">Add to cart</p><div class="value">${safe(shopify.cartAdditions)}</div><p class="note">Cart intent.</p></article>
        <article class="card"><p class="label">Checkout reached</p><div class="value">${safe(shopify.checkoutReached)}</div><p class="note">Checkout intent.</p></article>
        <article class="card"><p class="label">Completed checkout</p><div class="value">${safe(shopify.completedCheckouts)}</div><p class="note">Kan innehålla testköp.</p></article>
        <article class="card"><p class="label">Conversion rate</p><div class="value small">${safe(shopify.conversionRate)}</div><p class="note">7-dagars snapshot.</p></article>
        <article class="card"><p class="label">Device split</p><div class="split-panel">${splitCards(shopify.deviceSplit, "split-row")}</div></article>
        <article class="card"><p class="label">Social traffic</p><div class="value small">${safe(shopify.socialSessions || "Saknas")}</div><p class="note">Social sessions.</p><div class="split-panel">${splitCards(shopify.socialTrafficSplit, "split-row")}</div></article>
        <article class="card"><p class="label">Funnel diagnosis / warning</p><div class="value small">Bevaka checkout</div><p class="note">${safe(shopify.diagnostics.warning)} Källa: ${safe(shopify.sourceLabel || "Shopify Analytics snapshot")}.</p></article>
      </div>
    </section>

    <section class="section" aria-labelledby="ads-title">
      <div class="section-head"><div><p class="eyebrow">Ads</p><h2 id="ads-title">Annons-signal</h2></div><p class="hint">Förenklad vy. Ingen annons ändras här.</p></div>
      <div class="ad-grid">
        <article class="card"><span class="badge keep">Best ad right now</span><div class="value small">${safe(meta.bestAd)}</div><p class="note">${safe(meta.bestAdNote)}</p></article>
        <article class="card"><span class="badge warn">Weakest ad right now</span><div class="value small">${safe(meta.weakestAd)}</div><p class="note">${safe(meta.weakestAdNote)}</p></article>
        <article class="card"><p class="label">CTR</p><div class="value">${safe(meta.ctr)}</div><p class="note">Idag.</p></article>
        <article class="card"><p class="label">CPC</p><div class="value">${safe(meta.cpc)}</div><p class="note">Idag.</p></article>
        <article class="card"><p class="label">Landing page views</p><div class="value">${safe(meta.landingPageViews)}</div><p class="note">Idag.</p></article>
        <article class="card"><p class="label">Add to cart</p><div class="value">${safe(meta.addToCart)}</div><p class="note">Idag.</p></article>
        <article class="card"><p class="label">Purchases</p><div class="value">${safe(meta.purchases)}</div><p class="note">Idag.</p></article>
        <article class="card"><p class="label">Decision note</p><div class="value small">${safe(adDecisionNote)}</div><p class="note">Stoppa/pausa endast om spend fortsätter utan klick eller funnel-signal.</p></article>
      </div>
    </section>

    <section class="section" aria-labelledby="organic-title">
      <div class="section-head"><div><p class="eyebrow">Organic / Blotato</p><h2 id="organic-title">Nästa organiska steg</h2></div><p class="hint">Rapporten visar schema men postar eller schemalägger inget.</p></div>
      <div class="organic-grid">
        <article class="card"><p class="label">Next post time</p><div class="value small">${safe(organic.nextPost.time)}</div><p class="note">Nästa schemalagda post.</p></article>
        <article class="card"><p class="label">Main product focus</p><div class="value small">${safe(organic.nextPost.product)}</div><p class="note">Produkt som pushas härnäst.</p></article>
        <article class="card"><p class="label">TikTok video needed status</p><div class="value small">${tiktokNeedsVideo ? "Video behövs" : "Okej just nu"}</div><p class="note">${safe(organic.nextPost.risk)}</p></article>
        <article class="card"><p class="label">Blotato status</p><div class="value small">${organic.mode === "live" ? "Live schema" : "Fallback schema"}</div><p class="note">${safe(data.statusMessages.find((message) => message.includes("Blotato")) || "")}</p></article>
        <article class="card"><p class="label">Next organic action</p><div class="value small">${safe(nextOrganicAction)}</div><p class="note">Prioritera kort video före fler stillbilder.</p></article>
      </div>
      <div class="schedule-list compact-schedule" style="margin-top:12px;">${scheduleRows(organic.schedule)}
      </div>
    </section>

    <section class="section" aria-labelledby="bottom-queue-title">
      <div class="section-head"><div><p class="eyebrow">Slutbeslut</p><h2 id="bottom-queue-title">Next Action Queue</h2></div><p class="hint">Samma lista längst ner så du slipper scrolla tillbaka.</p></div>
      <ol class="queue-list">${actionQueueMarkup()}
      </ol>
    </section>

    <p class="footer">Generated automatically for The Clarity Shop at ${safe(data.updatedAt)}. Archive: <a href="archive/${safe(data.today)}.html">${safe(data.today)}</a>. Inga Meta Ads, Shopify-inställningar, Blotato-poster, Shopify-produkter, teman eller Drive-filer ändras.</p>
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
