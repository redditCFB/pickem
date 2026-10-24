# Pick 'Em — Developer Guide

Devvit app slug: `pickem-game`. Built with [Devvit Web](https://developers.reddit.com/) (React + Hono).

See [PICKEM_HANDOFF.md](./PICKEM_HANDOFF.md) for full product spec, API contracts, and integration checklist.

## Features

- **Weekly Pick 'Em post** — inline feed preview (top 3 standings + CTA) and expanded view with tabs
- **Make Picks** — pick winners + assign confidence points 1–10 with kickoff ordering
- **This Week** — slate with logos, kickoffs, live scores
- **Standings** — season leaderboard with tie collapsing
- **Mod tools** — configure slate (10 games), publish weekly post
- **Demo mode** — works offline with mock data when scoreboard/mods APIs are unavailable

## Prerequisites

- Node.js ≥ 22.20
- Reddit developer account + Devvit CLI (`npm install -g devvit` or use via npx)
- (Production) Scoreboard API at `scoreboard.redditcfb.com`
- (Production) Mods Pick'em API at `mods.redditcfb.com` + `devvit settings set modsApiSecret`

## Quick start

```bash
npm install
npm run login          # authenticate Devvit CLI (once)
```

### First-time setup (required before playtest)

This project was scaffolded from the Devvit template, so the **`pickem-game` app must be registered on Reddit** before playtest works. Local files alone are not enough.

**Option A — recommended**

1. Open [developers.reddit.com/new](https://developers.reddit.com/new) and create an app named **`pickem-game`**
2. Copy the setup code from the success page
3. In this directory, run:

```bash
npx devvit init --force
```

Paste the code when prompted. This links your local project to the Reddit app **without overwriting your code**.

4. Upload the first version:

```bash
npm run upload
```

5. Start playtest:

```bash
npm run dev
```

**Option B — upload triggers registration**

If you skip step 1–3, `npm run upload` will open the same registration wizard when it detects the app doesn't exist yet.

### Daily development

```bash
npm run dev            # playtest in a subreddit (after first upload)
```

### Local UI

Iterate on the React screens in a browser without uploading to Reddit:

```bash
npm run dev:client
```

Opens http://localhost:7474/game.html with hot reload. Also available:

- http://localhost:7474/splash.html — feed preview; click through to the game view
- http://localhost:7474/mod-setup.html — slate picker

The page uses in-memory mock games from `src/server/lib/mockData.ts`. Picks and slate edits last until you stop the dev server. They are not written to Redis or the mods API.

Append a query to preview another viewer (the default is a logged-in moderator):

- `?as=member` — picks only, no Setup tab
- `?as=logged-out` — signed-out state

`npm run dev` is still required to exercise Reddit auth, Redis, and the live scoreboard and mods APIs.

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Devvit playtest (live on Reddit) |
| `npm run dev:client` | Local React UI with hot reload (mock data) |
| `npm run build` | Build client + server bundles |
| `npm run deploy` | Type-check, lint, upload to Reddit |
| `npm run launch` | Deploy + publish for review |
| `npm run test:unit` | Run pick logic unit tests |
| `npm run verify:pipeline` | **Local** integration check (scoreboard + mods API; no Devvit) |
| `npm run login` | Authenticate Devvit CLI |

## Mod workflow

1. Install the app on your test subreddit and enable **Configure slate in app** (subreddit setting).
2. **Publish Pick 'Em Post** (mod menu) — creates the weekly custom post.
3. Open that post → expand → **Setup** tab (mods only) — pick season, week, and 10 games, then **Save slate**.
4. Users expand the same post → **Picks** tab → save before kickoff.

## Configuration

Set the mods API bearer token (required for production picks/standings):

```bash
devvit settings set modsApiSecret
```

HTTP domains are allow-listed in `devvit.json`:

- `scoreboard.redditcfb.com` — game data
- `mods.redditcfb.com` — picks, slate, standings
- `cdn.redditcfb.com` — team logos

**Playtest vs production:** Reddit may block custom HTTP domains (like `mods.redditcfb.com`) in **playtest** until they are approved for your app — even if listed in `devvit.json`. The app detects this and falls back to **scoreboard + Redis draft** (yellow Demo picks badge). Live scores still work. MySQL persistence activates automatically once the domain is allowed.

**If you see `PERMISSION_DENIED: HTTP request to domain mods.redditcfb.com is not allowed`:**

1. Confirm `mods.redditcfb.com` is in `devvit.json` → `permissions.http.domains` (it is in this repo).
2. **Re-upload the app** — the running playtest build may predate that domain. Stop playtest, run `npm run deploy` or `npm run dev` again so Reddit picks up the latest config.
3. For **App Directory / production**, custom domains may need approval in [Developer Settings](https://developers.reddit.com/my/settings) → HTTP domains (same flow as other Devvit apps).

Mod slate setup lives in the **Setup** tab inside each Pick 'Em post (no separate configure mod menu item).

**Reddit domain approval:** See [docs/REDDIT_DOMAIN_APPROVAL.md](./docs/REDDIT_DOMAIN_APPROVAL.md) (PDF: [docs/REDDIT_DOMAIN_APPROVAL.pdf](./docs/REDDIT_DOMAIN_APPROVAL.pdf)) for the one-page re-review request to paste into r/Devvit. Regenerate PDF: `node scripts/generate-domain-approval-pdf.mjs`.

## Verify the pipeline (without Reddit domain approval)

Playtest cannot call `mods.redditcfb.com` until Reddit approves the domain. That does **not** block backend verification — run checks **from your machine**, outside the Devvit sandbox:

```bash
# Read-only: devvit.json, scoreboard, mods auth, meta, standings
cp /path/to/devvit_api_secret .mods-api-secret   # gitignored; same value as devvit settings
npm run verify:pipeline

# Full round-trip for week 0 (uses existing mods slate if scoreboard has <10 games)
npm run verify:pipeline -- --week 0 --write
```

| Layer | What it proves | When |
|-------|----------------|------|
| `verify:pipeline` | Scoreboard live, mods API deployed, secret matches, MySQL wired | **Now** (local) |
| `verify:pipeline --write` | `game_ids` exist in `pickem.games`, pick short names match | After `loadGames` |
| Devvit playtest | UI, mod picker, Redis draft, scoreboard from sandbox | Now (demo picks if mods blocked) |
| Reddit HTTP approval | Devvit server can reach `mods.redditcfb.com` | Portal + re-upload |
| Playtest E2E | Picks persist through Devvit → mods → MySQL | After approval |

Secret must match on both sides: `devvit settings set modsApiSecret` ↔ server `devvit_api_secret`. See [PICKEM_MODS_API_HANDOFF.md](./PICKEM_MODS_API_HANDOFF.md).

## Architecture

```
src/client/     React UI (splash, game, mod-setup)
src/server/     Hono API — proxies to scoreboard + mods APIs, Redis post binding
src/shared/     Types, pick validation logic, API contracts
```

Post ↔ week binding stored in Devvit Redis: `post:{postId} → { season, week, group_id, slate_game_ids }`.

Official contest uses `group_id = 6`.

## API dependencies

| Service | Status | Used for |
|---------|--------|----------|
| Scoreboard `GET /api/v1/games` | Deploy pending | Game pool, slate display, kickoff lock |
| Mods `GET/PUT /pickem/*` | Build pending | Picks, slate, standings, scoring |

Until both are live, the app runs in **demo mode** with mock CFB games and sample standings.

## Deploy

```bash
npm run deploy
```

After upload, click **Update** in the [developer portal](https://developers.reddit.com) to push the new version to installed subreddits.
