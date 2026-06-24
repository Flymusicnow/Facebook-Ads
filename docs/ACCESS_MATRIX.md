# The Clarity Shop Access Matrix

Use this matrix before starting The Clarity Shop work so future Codex sessions know which workspace, tool access, environment variables, and safety boundaries are required.

## Meta Ads / Control Room

Used for:

* Meta Ads report
* Control Room dashboard

Required environment variables:

* `META_ACCESS_TOKEN`
* `META_AD_ACCOUNT_ID`
* `BLOTATO_TOKEN` if Blotato live schedule is needed

Relevant scripts:

* `npm run update:control-room`
* `npm run test:control-room`

Notes:

* The Control Room updater can fall back safely when live Meta Ads or Blotato data is missing.
* Do not print tokens, API responses with secrets, or private authorization headers.

## Blotato Setup & Posting

Used for:

* Blotato scheduled posts
* AI video previews if Blotato MCP supports it

Required access:

* Blotato MCP tools loaded
* `BLOTATO_TOKEN` available

Safety:

* Do not publish, schedule, delete, replace, or edit Blotato posts unless explicitly approved.
* Read-only checks are allowed when the user asks for schedule/status verification.
* Keep generated reports clear about whether Blotato live data loaded or fallback schedule data is being shown.

## Shopify Theme Access

Used for:

* Product page theme edits
* `buy-buttons.liquid` / trust notice work

Required access:

* Shopify Admin, Theme API, or Shopify connector with theme read/write access

Important theme IDs:

* Current live theme may change; always verify `MAIN` before writes.
* Previous relevant theme IDs:
  * `192247365958`
  * `192330301766`

Safety:

* Do not write to `MAIN` or the live theme automatically if policy blocks it.
* Use an unpublished draft theme when needed.
* Do not change product URLs, prices, checkout logic, or product images unless explicitly requested and approved.

## Shopify Analytics

Used for funnel metrics:

* Sessions
* Add to cart
* Checkout reached
* Completed checkout
* Conversion rate
* Social traffic
* Device split

Notes:

* Label purchase data carefully as `completed checkout` unless order source and customer type confirm real customer purchases.
* If live Shopify Analytics access is unavailable, use a clean manual snapshot or documented fallback structure.
* Do not store Shopify access tokens in repo files.

## Safety Rules

* Never print tokens.
* Never publish themes automatically unless explicitly approved and allowed.
* Never change live ads unless explicitly approved.
* Never publish Blotato posts unless explicitly approved.
* Never schedule, delete, replace, or edit Blotato posts unless explicitly approved.
* Never move, delete, upload, or replace Google Drive files unless explicitly approved.
* Always confirm changed files, tests, commit, push, and clean git status.

## Access Check Prompts

Check Blotato access:

```text
Check whether Blotato access is available for The Clarity Shop. Read-only only. Do not publish, schedule, edit, delete, or replace posts. Confirm whether Blotato MCP tools and BLOTATO_TOKEN are available.
```

Check Shopify theme access:

```text
Check whether Shopify theme access is available for The Clarity Shop. Read-only only. Do not write to MAIN/live theme. Confirm whether Shopify Admin, Theme API, or connector access is available and identify the current MAIN theme before any future write.
```

Check Meta Ads env vars:

```text
Check whether META_ACCESS_TOKEN and META_AD_ACCOUNT_ID are available for The Clarity Shop reporting. Read-only only. Do not change campaigns, budgets, ads, or audiences. Do not print token values.
```

Check Control Room update ability:

```text
Check whether The Clarity Shop Control Room can be updated locally. Run npm run test:control-room first, then npm run update:control-room if tests pass. Do not commit generated fallback/timestamp-only changes unless they are part of the requested task.
```
