# Facebook Ads Dashboard

Mobile-first Meta Ads reporting dashboard for The Clarity Shop.

## Live report path

After Vercel deployment, open:

```txt
/reports/meta-ads/latest.html
```

Short paths also work through `vercel.json`:

```txt
/latest
/meta-ads
```

The root `/` redirects to the latest report.

## Structure

```txt
Facebook-Ads/
├─ index.html
├─ vercel.json
├─ reports/
│  └─ meta-ads/
│     ├─ latest.html
│     └─ archive/
│        └─ 2026-06-21.html
├─ scripts/
│  └─ fetch-meta-report.py
└─ README.md
```

## Update report manually

Edit:

```txt
reports/meta-ads/latest.html
```

Then copy the same report into archive with the correct date:

```txt
reports/meta-ads/archive/YYYY-MM-DD.html
```

## Generate report locally

```bash
python scripts/fetch-meta-report.py
```

This writes:

```txt
reports/meta-ads/latest.html
reports/meta-ads/archive/2026-06-21.html
```

## Vercel setup

1. Go to Vercel.
2. Add New Project.
3. Import Git Repository.
4. Select `Flymusicnow/Facebook-Ads`.
5. Keep default static settings.
6. Deploy.

No environment variables are required for the current static version.

## Next upgrade

Connect `scripts/fetch-meta-report.py` to the Meta Marketing API so `latest.html` updates automatically every day.
