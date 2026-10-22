# Legal documents for Reddit Devvit app review

Reddit requires **Terms and Conditions** and a **Privacy Policy** for any app that uses [HTTP fetch](https://developers.reddit.com/docs/capabilities/server/http-fetch). Links must be added in the [developer portal](https://developers.reddit.com) app details for `pickem-game`.

## Files

| File | Use |
|------|-----|
| [PRIVACY.md](./PRIVACY.md) | Privacy Policy |
| [TERMS.md](./TERMS.md) | Terms and Conditions |

## Before publishing

Replace placeholders:

- `[DATE]` — effective date  
- `[CONTACT EMAIL]` — e.g. mod mail or pickem contact  
- `[STATE]` — in TERMS.md (optional, for governing law)

Update the Privacy Policy link in TERMS.md if you host at a different URL.

## Hosting (required: public HTTPS URLs)

Reddit needs **live links**, not repo paths. **Published on redditcfb.com:**

| Document | URL |
|----------|-----|
| Privacy Policy | https://pickem.redditcfb.com/legal/privacy.html |
| Terms and Conditions | https://pickem.redditcfb.com/legal/terms.html |

Source on server: `public_html/subs/pickem/legal/` in [redditCFB/redditcfb.com](https://github.com/redditCFB/redditcfb.com) (branch `dev/mod-scrape`, commit `fb6b00f`). **Pull/deploy on production** before submitting URLs to Reddit — static HTML is served without pick'em login.

## Developer portal

1. Open [developers.reddit.com/apps/pickem-game](https://developers.reddit.com/apps/pickem-game)  
2. App details / configuration  
3. Paste **Privacy Policy URL** and **Terms URL**  
4. Save, then upload/playtest so domain review includes legal compliance  

## Domain review blurb (paste into request or r/Devvit)

> Pick 'Em (`pickem-game`) is the official-style weekly CFB confidence pick'em for redditcfb communities. Server-side fetch only. `scoreboard.*` and `cdn.*` serve public game/logo data with no Reddit user identifiers. `mods.*` stores Reddit usernames and pick submissions in our existing pickem MySQL (same operator as pickem.redditcfb.com), authenticated via Devvit app secret. Privacy Policy and Terms are linked in app settings. Team logos are proxied through `/api/logo/` — webview never loads CDN directly.
