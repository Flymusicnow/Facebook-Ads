# The Clarity Shop Control Room Automation

This dashboard belongs to Dashboard & Reports. The updater only regenerates local HTML report files. It does not change Meta Ads, Shopify, Blotato posts, publishing schedules, or Google Drive files.

## Run manually

From the repository root:

```bash
npm run update:control-room
```

The script writes:

- `reports/the-clarity-shop-control-room/latest.html`
- `reports/the-clarity-shop-control-room/archive/YYYY-MM-DD.html`

## Optional secrets

Use these GitHub Secrets for live data:

- `META_ACCESS_TOKEN`
- `META_AD_ACCOUNT_ID`
- `META_API_VERSION` optional, defaults to `v25.0`
- `BLOTATO_TOKEN`
- `BLOTATO_SCHEDULE_URL` optional, used if the Blotato schedule endpoint changes
- `SHOPIFY_FUNNEL_JSON` optional, a sanitized JSON snapshot for Shopify funnel metrics

Do not print tokens in logs. The updater only prints plain status messages such as whether live data loaded or fallback data was used.

## Shopify funnel data

There is no live Shopify API integration in this repository yet. The Control Room therefore uses a safe placeholder unless a sanitized funnel snapshot is provided.

Optional JSON shape for `SHOPIFY_FUNNEL_JSON`:

```json
{
  "sessions": 120,
  "sessionsWithCartAdditions": 9,
  "reachedCheckout": 4,
  "completedCheckouts": 1,
  "conversionRate": 0.83,
  "deviceSplit": { "Mobile": 98, "Desktop": 22 },
  "socialTrafficSplit": { "Facebook": 50, "Instagram": 44, "TikTok": 26 }
}
```

For local testing, the same JSON can be saved outside the repo and referenced with `SHOPIFY_FUNNEL_DATA_FILE=/absolute/path/to/shopify-funnel.json`.

Next step for true live Shopify funnel data: connect a read-only Shopify Analytics or exported analytics source that can provide sessions, cart additions, reached checkout, completed checkout, conversion rate, device split, and social traffic split. Do not store Shopify access tokens in files.

## If live data is missing

The dashboard still builds safely.

- If Meta Ads credentials are missing or the read fails, it shows: `Meta Ads live data missing. Showing fallback values.`
- If Blotato credentials are missing or the read fails, it shows: `Blotato live data missing. Showing last known schedule.`
- If Shopify funnel data is missing or invalid, it shows: `Shopify live funnel data missing. Showing known signals placeholder.`

The fallback Blotato schedule is the last known schedule already used in the Control Room.
The fallback Shopify funnel is a placeholder based on the currently known signals: sessions exist, some add to cart events exist, checkout has been reached, the test purchase works, and no verified non-test purchases are confirmed yet.

## Archive behavior

Every run replaces `latest.html` and writes a dated archive copy at `archive/YYYY-MM-DD.html`.

The GitHub Actions workflow runs manually with `workflow_dispatch` and daily in the morning. It commits only when the regenerated dashboard files are different.
