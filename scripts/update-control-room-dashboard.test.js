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
  assert.match(data.statusMessages.join(" "), /Meta Ads live data missing/);
  assert.match(data.statusMessages.join(" "), /Blotato live data missing/);
  assert.match(data.statusMessages.join(" "), /Shopify live funnel data missing/);
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
  assert.match(html, /0 verifierade/);
  assert.match(html, /Shopify live funnel data missing\. Showing known signals placeholder\./);
  assert.match(html, /1847490/);
  assert.match(html, /Money Clarity Reset/);

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
  assert.match(data.statusMessages.join(" "), /Shopify funnel data loaded from provided JSON/);
  assert.match(html, /Mobile/);
  assert.match(html, /Facebook/);
  assert.match(html, /Provided/);
});
