# Facebook Ads Dashboard

Mobile-first Meta Ads reporting dashboard for The Clarity Shop.

## Live Vercel URL

```txt
https://facebook-ads-teal.vercel.app/reports/meta-ads/latest
```

Alternative paths:

```txt
https://facebook-ads-teal.vercel.app/latest
https://facebook-ads-teal.vercel.app/meta-ads
```

## What is live now

The Vercel page is live.

The repo now also includes a GitHub Actions live-update system that can update the report every hour.

## What is still needed for real Facebook Ads data

Add these GitHub repository secrets:

```txt
META_ACCESS_TOKEN
META_AD_ACCOUNT_ID
```

Optional secret:

```txt
META_API_VERSION
```

Default API version in the script is `v20.0`.

## How to add secrets in GitHub

1. Open the GitHub repo `Flymusicnow/Facebook-Ads`.
2. Go to `Settings`.
3. Go to `Secrets and variables`.
4. Click `Actions`.
5. Click `New repository secret`.
6. Add:

```txt
Name: META_ACCESS_TOKEN
Secret: your Meta access token
```

7. Add:

```txt
Name: META_AD_ACCOUNT_ID
Secret: act_1234567890
```

The ad account ID can include or exclude `act_`. The script handles both.

## Automatic update

The workflow runs every hour:

```txt
.github/workflows/update-meta-report.yml
```

It runs:

```bash
python scripts/fetch-meta-report.py
```

Then commits the updated files:

```txt
reports/meta-ads/latest.html
reports/meta-ads/archive/YYYY-MM-DD.html
```

When GitHub commits the updated report, Vercel should auto-deploy if the repo is connected through Vercel Git integration.

## Manual update

You can also run it manually in GitHub:

1. Open `Actions`.
2. Choose `Update Meta Ads Report`.
3. Click `Run workflow`.

## Structure

```txt
Facebook-Ads/
├─ index.html
├─ vercel.json
├─ .github/
│  └─ workflows/
│     └─ update-meta-report.yml
├─ reports/
│  └─ meta-ads/
│     ├─ latest.html
│     └─ archive/
│        └─ 2026-06-21.html
├─ scripts/
│  └─ fetch-meta-report.py
└─ README.md
```

## Fallback mode

If secrets are missing, the script still creates a report, but it will show fallback/static data and clearly say that Meta secrets are missing.

Deployment trigger 2026-06-25
