# Blotato Access Notes for The Clarity Shop

Use this note when a Codex chat needs Blotato access for The Clarity Shop.

## Current known configuration

The local Codex config has a Blotato MCP server configured:

- Server name: `blotato`
- URL: `https://mcp.blotato.com/mcp`
- Token environment variable: `BLOTATO_TOKEN`

The expected repo/workspace for The Clarity Shop work is:

- Repo: `Flymusicnow/Facebook-Ads`
- Local path in Codex workspaces: `work/Facebook-Ads`

## Required checks before Blotato work

Run this from the active Codex shell without printing the secret:

```bash
python3 - <<'PY'
import os
print("BLOTATO_TOKEN:", "SET" if os.getenv("BLOTATO_TOKEN") else "MISSING")
PY
```

Then use tool discovery for Blotato:

```text
Search for: Blotato blotato MCP create visual list accounts schedules
```

Expected MCP namespace when access is working:

```text
mcp__blotato
```

Useful read-only tools when loaded:

- `blotato_get_user`
- `blotato_list_accounts`
- `blotato_list_schedules`
- `blotato_get_schedule`
- `blotato_list_visual_templates`
- `blotato_get_visual_status`

Useful creation-only visual tools when loaded:

- `blotato_create_visual`

Important: `blotato_create_visual` creates a visual/video draft or render. It does not publish by itself. Do not use post, schedule, update, or delete tools unless the user explicitly confirms the exact live action.

## What it means if access is missing

If `BLOTATO_TOKEN` is `MISSING`, the Blotato MCP server cannot authenticate and Blotato tools may not appear in the active session.

If the MCP server is configured but the tools are missing, the most likely cause is that the Codex desktop app/session was started without `BLOTATO_TOKEN` in its environment. Setting the token inside a later shell may not be enough for already-started MCP tool discovery.

## Fix steps

1. Add or restore `BLOTATO_TOKEN` in the environment used to launch Codex Desktop.
2. Restart the Codex Desktop app or start a new Codex session after the token is available.
3. Re-run the safe token check above.
4. Search for Blotato tools again.
5. Verify access with read-only calls first:
   - `blotato_get_user`
   - `blotato_list_accounts`
6. Confirm The Clarity Shop accounts before any post-related work:
   - Facebook page: `The Clarity Shop`
   - Instagram: `theclarityshopdigital`
   - TikTok: `theclarityshop`
   - YouTube: `clarityshop`

## Repo automation context

The Control Room updater also expects `BLOTATO_TOKEN` as an optional secret. In GitHub Actions, it is read from:

```text
secrets.BLOTATO_TOKEN
```

The updater reads Blotato schedule data only. It does not publish, schedule, delete, or replace Blotato posts.

## Safety rules

Never print tokens or API keys.

Do not publish, schedule, delete, update, or replace Blotato posts without explicit user confirmation.

Do not change Meta Ads, Shopify, Google Drive, or the Control Room when the task is only to check Blotato access or create a video preview.

For The Clarity Shop creative work, read these files first:

- `AGENTS.md`
- `brand/the-clarity-shop/BRAND_GUIDE.md`
- `brand/the-clarity-shop/CONTENT_STYLE_RULES.md`
- `brand/the-clarity-shop/SOCIAL_POSTING_RULES.md`
- `brand/the-clarity-shop/PRODUCT_LIBRARY.md`
- `brand/the-clarity-shop/CODEX_WORKFLOW_RULES.md`

## Manual fallback prompt for Blotato AI video creation

Use this if Blotato MCP/API access is unavailable but a human can create the draft in the Blotato UI, Canva, CapCut, or InVideo.

```text
Create a 7-10 second vertical 9:16 short-form video for The Clarity Shop product "The Situationship Exit Strategy".

Goal:
Calm, emotional, premium video for TikTok, Instagram Reels, and Facebook Reels.

Brand mood:
Calm, premium, feminine, emotionally intelligent, soft, warm, clear, practical.

Visual style:
Cream and beige tones, soft natural light, elegant minimal background, gentle shadows, premium digital workbook feeling, realistic visuals.
No anime. No cartoon. No exaggerated AI look. No fake-looking faces.
No private names, phone numbers, or readable personal message content on phone screens.

Scene 1, 0-2s:
Visual: Soft beige background. The Situationship Exit Strategy workbook cover visible. Slow zoom.
Text: If you have to keep guessing where you stand...
Voiceover: If you have to keep guessing where you stand...

Scene 2, 2-5s:
Visual: Close-up of a phone with an unread message. Soft light. No readable names, numbers, or private messages.
Text: that is already information.
Voiceover: that is already information.

Scene 3, 5-8s:
Visual: Workbook cover again. Gentle checkmarks or page-turn effect.
Text: Get clear in 7 days.
Voiceover: The Situationship Exit Strategy helps you stop spiraling and choose from clarity.

Scene 4, 8-10s:
Visual: Product cover plus The Clarity Shop branding.
Text: Instant PDF download
Voiceover: Download it today from The Clarity Shop.

Caption:
If mixed signals are making you overthink everything, this 7-day workbook helps you pause, reflect, and decide what comes next. Instant PDF download.

CTA:
Shop now

Quality checklist:
Text readable on mobile. Premium calm design. Product visible. CTA clear. No weird AI artifacts. No cartoon/anime style. No confusing message content. Fits TikTok/Reels vertical format. Feels emotionally clear, not desperate.
```
