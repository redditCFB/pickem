# Pick 'Em → Mods API Handoff

The Devvit app (`pickem-game`) persists picks to MySQL via **`mods.redditcfb.com/api/devvit/v1/pickem/*`**.

Implementation lives in the **redditcfb.com** repo:

```
../redditcfb/redditcfb.com/docs/PICKEM_DEVVIT_API.md
../redditcfb/redditcfb.com/public_html/subs/mods/api/devvit/v1/lib/PickemDevvit.php
../redditcfb/redditcfb.com/public_html/subs/mods/api/devvit/v1/handlers/pickem.php
```

## Your side (pickem repo) — done

- [x] `modsApiSecret` set via `devvit settings set modsApiSecret`
- [x] Client calls in `src/server/lib/modsApi.ts`

## redditcfb.com side — deploy required

1. Deploy updated `api/devvit/v1/` to production
2. Confirm `scripts/devvit_api_secret` on server matches Devvit secret
3. Smoke test: `curl -H "Authorization: Bearer $SECRET" …/pickem/meta`
4. Ensure `pickem.games` populated for target week (`loadGames`)

## After deploy

```bash
npm run dev
```

Mod slate → publish → save picks → check `pickem.picks` in MySQL and web site.

Full API contract: **`../redditcfb/redditcfb.com/public_html/subs/mods/api/devvit/v1/PICKEM_DEVVIT_API.md`**
