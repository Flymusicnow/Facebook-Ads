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

Do not print tokens in logs. The updater only prints plain status messages such as whether live data loaded or fallback data was used.

## If live data is missing

The dashboard still builds safely.

- If Meta Ads credentials are missing or the read fails, it shows: `Meta Ads live data missing. Showing fallback values.`
- If Blotato credentials are missing or the read fails, it shows: `Blotato live data missing. Showing last known schedule.`

The fallback Blotato schedule is the last known schedule already used in the Control Room.

## Archive behavior

Every run replaces `latest.html` and writes a dated archive copy at `archive/YYYY-MM-DD.html`.

The GitHub Actions workflow runs manually with `workflow_dispatch` and daily in the morning. It commits only when the regenerated dashboard files are different.
