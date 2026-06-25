const assert = require("node:assert/strict");
const { mkdtempSync, readFileSync, existsSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { buildControlRoomData, renderDashboard, writeDashboard } = require("./update-control-room-dashboard");

test("builds fallback control room data when live tokens are missing", async () => {
  const data = await buildControlRoomData({
    env: {},
    today: "2026-06-22",
    now: new Date("2026-06-22T10:00:00.000Z"),
    fetchImpl: async () => {
      throw new Error("fetch should not run without tokens");
    },
  });

  assert.equal(data.meta.mode, "fallback");
  assert.equal(data.organic.mode, "fallback");
  assert.equal(data.shopify.mode, "fallback");
  assert.equal(data.shopify.sessions, "183");
  assert.equal(data.shopify.cartAdditions, "7");
  assert.equal(data.shopify.checkoutReached, "12");
  assert.equal(data.shopify.completedCheckouts, "2");
  assert.equal(data.shopify.conversionRate, "ca 1,09%");
  assert.match(data.statusMessages.join(" "), /Meta Ads live data missing/);
  assert.match(data.statusMessages.join(" "), /Blotato live data missing/);
  assert.match(data.statusMessages.join(" "), /manual 7-day Shopify Analytics snapshot/);
  assert.equal(data.organic.schedule.length, 12);
  assert.equal(data.organic.nextPost.time, "22 June 2026 19:00");
});

test("renders and writes latest plus dated archive", async () => {
  const outDir = mkdtempSync(path.join(tmpdir(), "control-room-"));
  const data = await buildControlRoomData({
    env: {},
    today: "2026-06-22",
    now: new Date("2026-06-22T10:00:00.000Z"),
    fetchImpl: async () => {
      throw new Error("fetch should not run without tokens");
    },
  });
  const html = renderDashboard(data);

  assert.match(html, /The Clarity Shop/);
  assert.match(html, /Blotato live data missing\. Showing last known schedule\./);
  assert.match(html, /Meta Ads live data missing\. Showing fallback values\./);
  assert.match(html, /Shopify Funnel/);
  assert.match(html, /Idag/);
  assert.match(html, /7 dagar/);
  assert.match(html, /30 dagar/);
  assert.match(html, /Totalt/);
  assert.match(html, /Budget & Spend/);
  assert.match(html, /Next Action Queue/);
  assert.match(html, /Completed checkout/);
  assert.match(html, /<meta charset="UTF-8" \/>/);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" \/>/);
  assert.match(html, /ca 1,09%/);
  assert.match(html, /nästa/);
  assert.match(html, /från/);
  assert.match(html, /köp/);
  assert.match(html, /ändras/);
  assert.match(html, /saknas/);
  assert.match(html, /manuell/);
  assert.match(html, /7-dagars/);
  assert.match(html, /overflow-x:hidden/);
  assert.match(html, /max-width:100%/);
  assert.match(html, /html,\s*body \{ width:100%; max-width:100%; min-width:0; overflow-x:hidden; margin:0; padding:0; \}/);
  assert.match(html, /@media \(max-width:600px\)/);
  assert.match(html, /\.status-row \.pill/);
  assert.match(html, /main,.wrap,.page,.shell,.container \{ display:block; width:100%; max-width:100%; min-width:0;/);
  assert.match(html, /\.report-canvas,.layout,.layout-wrapper,.grid,.grid-container,.dashboard-grid,.content-grid/);
  assert.match(html, /display:block !important; width:100% !important; max-width:100% !important; min-width:0 !important; position:static !important; transform:none !important;/);
  assert.match(html, /\[class\*="card"\],\[class\*="section"\]/);
  assert.match(html, /\.hero::before,.hero::after,body::before,body::after,.decor,.decorative-bg,.background-shape,.bg-panel,\[class\*="decor"\] \{ display:none !important; width:0 !important; \}/);
  assert.match(html, /Shopify: manuell 7-dagars snapshot/);
  assert.match(html, /manuell 7-dagars snapshot/);
  assert.doesNotMatch(html, /Shopify: placeholder/);
  assert.doesNotMatch(html, /\b(nasta|fran|kop|andrar|bekraftade)\b/i);
  assert.match(html, /Completed checkout kan innehålla testköp/);
  assert.match(html, /Shopify live funnel data missing\. Showing manual 7-day Shopify Analytics snapshot\./);
  assert.match(html, /1847490/);

  const written = writeDashboard(html, { outputRoot: outDir, today: "2026-06-22" });
  assert.ok(existsSync(written.latestPath));
  assert.ok(existsSync(written.archivePath));
  assert.equal(readFileSync(written.latestPath, "utf8"), readFileSync(written.archivePath, "utf8"));
});

test("maps Blotato live schedule fields into readable dashboard rows", async () => {
  const data = await buildControlRoomData({
    env: {
      BLOTATO_TOKEN: "test-token",
    },
    today: "2026-06-22",
    now: new Date("2026-06-22T10:00:00.000Z"),
    fetchImpl: async (url) => {
      if (String(url).includes("blotato")) {
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                id: "1847511",
                platform: "tiktok",
                text: "One week. Six resets. Total clarity. The Full Clarity Library — link in bio.",
                mediaUrls: ["https://cdn.example.test/full-library.jpeg"],
                postTime: "2026-06-25T09:00:00.000Z",
                state: { type: "scheduled" },
              },
              {
                id: "4863347",
                platform: "instagram",
                text: "Get clear on your next step with Money Clarity Reset.",
                mediaUrls: ["https://cdn.example.test/money-reset.mp4"],
                postTime: "2026-06-26T08:30:00.000Z",
                state: { type: "scheduled" },
              },
              {
                id: "published-1",
                platform: "facebook",
                text: "The Career & Business Reset helps you choose your next step.",
                mediaUrls: ["https://cdn.example.test/career.png"],
                postTime: "2026-06-20T08:30:00.000Z",
                state: { type: "published" },
              },
            ],
          }),
        };
      }
      throw new Error("Meta should fall back in this test");
    },
  });

  assert.equal(data.organic.mode, "live");
  assert.equal(data.organic.schedule.length, 2);
  assert.equal(data.organic.schedule[0].time, "25 June 2026 11:00");
  assert.equal(data.organic.schedule[0].account, "@theclarityshop");
  assert.equal(data.organic.schedule[0].product, "Full Clarity Library");
  assert.equal(data.organic.schedule[0].mediaType, "image/jpeg");
  assert.equal(data.organic.schedule[0].status, "Needs video later");
  assert.equal(data.organic.schedule[1].time, "26 June 2026 10:30");
  assert.equal(data.organic.schedule[1].product, "Money Clarity Reset");
  assert.equal(data.organic.schedule[1].mediaType, "video");
  assert.equal(data.organic.schedule[1].status, "Keep");
});

test("loads Shopify funnel metrics from provided JSON", async () => {
  const data = await buildControlRoomData({
    env: {
      SHOPIFY_FUNNEL_JSON: JSON.stringify({
        sessions: 120,
        sessionsWithCartAdditions: 9,
        reachedCheckout: 4,
        completedCheckouts: 1,
        conversionRate: 0.83,
        socialSessions: 120,
        sourceLabel: "Test Shopify Analytics snapshot",
        deviceSplit: { Mobile: 98, Desktop: 22 },
        socialTrafficSplit: { Facebook: 50, Instagram: 44, TikTok: 26 },
      }),
    },
    today: "2026-06-22",
    now: new Date("2026-06-22T10:00:00.000Z"),
    fetchImpl: async () => {
      throw new Error("fetch should not run without live tokens");
    },
  });
  const html = renderDashboard(data);

  assert.equal(data.shopify.mode, "provided");
  assert.equal(data.shopify.sessions, "120");
  assert.equal(data.shopify.cartAdditions, "9");
  assert.equal(data.shopify.checkoutReached, "4");
  assert.equal(data.shopify.completedCheckouts, "1");
  assert.equal(data.shopify.conversionRate, "0,83%");
  assert.equal(data.shopify.socialSessions, "120");
  assert.match(data.statusMessages.join(" "), /Shopify funnel data loaded from provided JSON/);
  assert.match(html, /Mobile/);
  assert.match(html, /Facebook/);
  assert.match(html, /Test Shopify Analytics snapshot/);
  assert.match(html, /provided funnel data/);
});
