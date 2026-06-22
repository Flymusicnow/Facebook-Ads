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
  assert.match(data.statusMessages.join(" "), /Meta Ads live data missing/);
  assert.match(data.statusMessages.join(" "), /Blotato live data missing/);
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
  assert.match(html, /1847490/);
  assert.match(html, /Money Clarity Reset/);

  const written = writeDashboard(html, { outputRoot: outDir, today: "2026-06-22" });
  assert.ok(existsSync(written.latestPath));
  assert.ok(existsSync(written.archivePath));
  assert.equal(readFileSync(written.latestPath, "utf8"), readFileSync(written.archivePath, "utf8"));
});
