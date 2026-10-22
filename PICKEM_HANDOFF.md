# /r/CFB Pick 'Em — Devvit App Handoff

**Audience:** Agent building the Pick 'Em Devvit app (separate repo)  
**Prerequisite:** Scoreboard Games API — implemented in this repo (`backend/api_v1.py`); deploy to `https://scoreboard.redditcfb.com` before Devvit Phase 1 testing  
**Reference implementation:** `public_html/subs/pickem/` in `redditcfb.com`  
**Live site today:** `https://pickem.redditcfb.com` (PHP/MySQL — to be replaced)  
**Last updated:** August 2026  

---

## 1. Build order & dependencies

```
Phase 1 (scoreboard repo)     Phase 2 (this app)              Phase 3 (redditcfb.com)
─────────────────────────     ──────────────────              ───────────────────────
GET /api/v1/games        →    Devvit Pick 'Em app       ←    POST /pickem/* on mods API
(implemented — deploy)        (UI + post type)                (picks, slate, standings,
 kickoffs, scores)                                            scoring cron trigger)
```

| Dependency | Owner | Status | Used for |
|------------|-------|--------|----------|
| **Scoreboard API** | scoreboard repo | Implemented — deploy to prod | All game data — mod picker, slate display, kickoff lock, winner resolution |
| **Mods Pick'em API** | redditcfb.com | Build in parallel or just before app | Picks, slate, standings, scoring |
| **CDN logos** | existing infra | ✅ Live | Rendered via scoreboard API `logo_url` fields |
| **Devvit platform** | Reddit | — | Post type, mod tools, Reddit identity |

**This app should NOT call ESPN directly.** Game lists come exclusively from the scoreboard API.

Handoff for scoreboard work: `SCOREBOARD_HANDOFF.md` (this repo)

---

## 2. Product goal

Build a **fully in-Reddit Pick 'Em** for `/r/CFB` using Devvit:

- Users submit confidence-point picks without leaving Reddit
- Mods select 10 games/week from the full D1 pool and publish a **Pick 'Em post**
- Post shows weekly slate + season standings + embedded pick UI
- Season scores persist week-to-week

**v1 scope:** Official `/r/CFB` contest only (`group_id = 6`, "Official RedditCFB").  
**Out of scope v1:** Custom password-protected leagues (`group.php`, `admin.php`).

---

## 3. Game format — confidence points

Port rules from `public_html/subs/pickem/rules.php` and logic in `classes/Pick.php`.

### User flow (before kickoff)

1. For each of the **10 slate games**, pick **away** or **home** winner.
2. **Order games by confidence** — assign points 1–10, each used exactly once:
   - **10** = most confident
   - **1** = least confident
3. Save → server validates and persists.

### Kickoff ordering & missed picks

Games sort by kickoff time (`kickoff_et` from scoreboard API).

If a user hasn't finished assigning points before games start:

- **Started games** auto-receive the **lowest remaining** point values (1, 2, 3…).
- **Future games** keep the highest available points.

Reference: `Pick::createWeekPicks()`, `Pick::reshuffleUnselectedPicks()`, `pickem_interface.php` (jQuery UI sortable).

### Scoring (when game is final)

- Correct pick → add `points × week_multiplier` to season total.
- Wrong pick → 0.
- **Canceled game** → all picks receive points (with multiplier). Reference: `Games::gameCanceledUpdate()`.

### Week multipliers

Bowl/playoff weeks may use `multiplier > 1` (`pickem.weeks` table). Support on official contest.

### Timezone

All kickoff lock comparisons use **America/New_York**. Scoreboard API provides `kickoff_at` (ISO) and `kickoff_et`; mods API enforces lock server-side.

---

## 4. Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Devvit Pick 'Em App                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │ Post type   │  │ Pick UI      │  │ Mod setup menu │ │
│  │ (slate +    │  │ (confidence  │  │ (select 10     │ │
│  │  standings) │  │  drag-sort)  │  │  games, publish)│
│  └──────┬──────┘  └──────┬───────┘  └───────┬────────┘ │
└─────────┼────────────────┼──────────────────┼───────────┘
          │                │                  │
          │  game data     │  picks/slate/    │
          │                │  standings       │
          ▼                ▼                  ▼
┌──────────────────┐  ┌────────────────────────────────────┐
│ scoreboard.      │  │ mods.redditcfb.com                 │
│ redditcfb.com    │  │ /api/devvit/v1/pickem/*            │
│ /api/v1/games    │  │ (Bearer auth, MySQL pickem DB)     │
└──────────────────┘  └────────────────────────────────────┘
```

### Storage strategy (recommended)

| Data | Where | Why |
|------|-------|-----|
| Games, scores, status | Scoreboard API | Single source of truth |
| Slate (10 game IDs/week) | MySQL via mods API | Matches legacy mod workflow |
| User picks | MySQL via mods API | Migration path from existing standings |
| Season totals & rankings | MySQL via mods API | Preserve `pickem.scores` history |
| Post ↔ week binding | Devvit Redis/KV | `post_id → { season, week, group_id }` |
| UI cache (optional) | Devvit Redis | Draft picks, standings snapshot |

### Reddit identity

Legacy site uses OAuth on `pickem.redditcfb.com`. Devvit uses **Reddit username / t2_id from Devvit context**. Mods API resolves username → `pickem.users` row on first pick.

---

## 5. Scoreboard API usage

**Base:** `https://scoreboard.redditcfb.com/api/v1`

### Mod: load game pool

```http
GET /api/v1/games?season=2025&week=7&division=d1
```

Returns all D1 (FBS + FCS) games for the mod picker. Response envelope:

```json
{ "ok": true, "meta": { "season": 2025, "week": 7, "count": 142 }, "items": [ ... ] }
```

Mod selects exactly **10** `id` values from `items`.

**Pick strings:** use `game.away.short` and `game.home.short` when submitting picks to the mods API. These come from `team_data.abbreviated` in the scoreboard DB — validate against `pickem.standard_team_names` during integration.

### Display: slate in post

After slate is saved (via mods API), fetch those 10 games:

```http
GET /api/v1/games/401752677?season=2025
```

Response: `{ "ok": true, "item": { ... } }` (single game object, same shape as list items).

(or filter client-side from cached week list)

### Kickoff lock (client + server)

- **Client:** Disable editing when `game.is_locked_for_picks === true`
- **Server:** Mods API rejects pick changes when `now_ET > kickoff_et` (never trust client clock)

### Live score updates

Poll scoreboard API during game day to show live scores in post (optional v1). Final scoring runs via mods API cron, not in Devvit.

### Devvit whitelist (`devvit.json`)

```json
{
  "http": {
    "domains": [
      "scoreboard.redditcfb.com",
      "mods.redditcfb.com",
      "cdn.redditcfb.com"
    ]
  },
  "media": {
    "domains": ["cdn.redditcfb.com"]
  }
}
```

---

## 6. Mods Pick'em API (redditcfb.com — to be built)

Same auth pattern as CFB Referee API. See `docs/DEVVIT_APP_API_STATUS.md`.

| Setting | Value |
|---------|--------|
| Base URL | `https://mods.redditcfb.com/api/devvit/v1` |
| Auth | `Authorization: Bearer <DEVVIT_API_SECRET>` |

### Meta

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/pickem/meta` | `{ current_week, current_season }` |
| PUT | `/pickem/meta` | Mod: set week/season |

### Slate (mod)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/pickem/slate` | `?season&week&group_id=6` → 10 game IDs + cached game snapshots |
| PUT | `/pickem/slate` | `{ game_ids: [10 espn ids] }` — validate count=10, same week/season, not started |

Slate game IDs must exist in scoreboard API. Server validates by fetching or checking cached sync.

### Picks (user)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/pickem/picks/me` | Current user's picks for week (Devvit passes Reddit user) |
| PUT | `/pickem/picks` | Submit `{ picks: [{ game_id, pick, points }] }` |

**Validation (port from `Pick.php`):**

- `pick` must equal `away.short` or `home.short` for that game
- Points = permutation of 1..10, no duplicates
- All 10 slate games must be present
- Reject if any game past kickoff (422)
- Reject games not on slate

### Standings

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/pickem/standings` | `?season&group_id=6&limit=50` |
| GET | `/pickem/standings/top` | Top 10 with ties at 10th (port `generate_post.php`) |

Ranking: `RANK() OVER (PARTITION BY group_id ORDER BY total DESC)` — competition ranking (1, 2, 2, 4).

### Scoring (cron)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/pickem/score/run` | Idempotent finalize for week/season |

Implementation wraps `Games::endGames()` but resolves winners from **scoreboard API** (or synced `pickem.games` populated from scoreboard) instead of per-game ESPN summary calls.

---

## 7. Devvit app features

### Post type: `pickem-weekly`

**Feed / collapsed view**

- Title: `Week {n} Pick 'Em — Standings & Slate`
- Preview: top 3 standings, "10 games this week"
- CTA: "Make your picks"

**Expanded view (tabs)**

1. **Make Picks** — interactive confidence UI
2. **This Week** — 10 games with logos, kickoffs, user's picks
3. **Standings** — season leaderboard
4. **Rules** — short confidence-points explainer

### Pick UI (port from `pickem_interface.php`)

- Games sorted by kickoff; started games sink to bottom, disabled
- Per game: logos (`logo_url`), team names, kickoff time, winner radio
- Drag-reorder (or mobile up/down) for confidence points
- Point badge (1–10) on each row
- Save → `PUT /pickem/picks`
- Show confirmation + user's season total

### Mod setup (mod menu or mod-only config)

1. Confirm **season** + **week** (from `/pickem/meta` or manual)
2. **Load games** — fetch scoreboard API `GET /games?division=d1`
3. **Searchable picker** — mod selects exactly 10 games
4. Preview slate (logos, times)
5. **Publish** — `PUT /pickem/slate` + create Reddit post
6. Optional: set week **multiplier** for bowls

Slate immutable after first kickoff (mod override only with audit log).

### Post ↔ week binding

On publish, store in Devvit KV:

```
post:{postId} → { season, week, group_id: 6, slate_game_ids: [...] }
```

All pick submissions for that post resolve to that week/season.

---

## 8. Weekly post content

Port structure from `generate_post.php`:

1. Header links (rules, prizes thread if applicable)
2. **Top 10 standings** — ties collapsed on one row
3. **This week's 10 games** — Away vs Home with flair anchors `#f/{flair_slug}`
4. CTA — embedded pick UI (no link to pickem.redditcfb.com)

Example standings:

```markdown
Rank|User(s)|Score
-:|-|-:
1|/u/user1|142
2|/u/user2, /u/user3|138
```

Example games (use `flair_slug` from scoreboard API):

```markdown
|Away|Home|
|:--|:--|
|[Indiana](#f/indiana)|[Michigan](#f/michigan)|
```

---

## 9. Legacy reference map

| Area | Path | Notes |
|------|------|-------|
| Pick UI | `pickem_interface.php` | Sortable list, kickoff lock client-side |
| Pick save | `posted_picks.php` | POST handler → port to mods API |
| Pick logic | `classes/Pick.php` | Kickoff lock, point assignment |
| Finalize/score | `classes/Games.php` | `endGames()` — every 15 min cron |
| Rankings | `classes/Rankings.php` | Competition ranking |
| Mod slate | `admin.php` | Select 10 → `selected_games` |
| Post generator | `generate_post.php` | Markdown template |
| Standings | `standings.php` | Full leaderboard |
| Config | `scripts/pickem/config.py` | `default_group_id = 6` |
| Cron | `scripts/crontab.txt` | `*/15 * * * * endGames.php` |

### Legacy MySQL schema (mods API backs this)

```
pickem.states          — current_week, current_season
pickem.games           — synced from scoreboard (espn_id keyed)
pickem.selected_games  — weekly slate per group
pickem.picks           — user × game × group, points + pick
pickem.scores          — season totals + ranking
pickem.users           — id, username
pickem.weeks           — week multipliers
pickem.standard_team_names — team normalization
```

Official group: **`group_id = 6`**

---

## 10. Validation checklist (implement exactly)

### Pick submission

- [ ] Winner picked for each of 10 games
- [ ] Points = unique values 1..10
- [ ] `pick` matches scoreboard `away.short` or `home.short`
- [ ] No edits after kickoff (422 from mods API)
- [ ] Only slate games accepted

### Slate setup

- [ ] Exactly 10 games
- [ ] Same week + season
- [ ] All IDs valid in scoreboard API
- [ ] Warn if any game already started

### Scoring

- [ ] Score only when scoreboard `status=final`
- [ ] Idempotent — re-run does not double-count
- [ ] Week multiplier applied
- [ ] Canceled → all picks get points

---

## 11. Implementation phases

### Phase 1 — Read-only post (after scoreboard API live)

- [ ] Devvit project scaffold + domain whitelist
- [ ] Fetch week games from scoreboard API
- [ ] Display slate + standings (mods API or static for testing)
- [ ] Custom post type shell

### Phase 2 — Picks MVP (requires mods API)

- [ ] Pick UI with confidence sort
- [ ] `PUT /pickem/picks` integration
- [ ] Kickoff lock (client + server)
- [ ] Mod slate picker → `PUT /pickem/slate`

### Phase 3 — Mod workflow & publish

- [ ] Mod menu: set week, select 10, publish post
- [ ] Post binds to week/season
- [ ] Standings refresh after scoring

### Phase 4 — Automation

- [ ] Scoring cron via `POST /pickem/score/run`
- [ ] Optional: deprecate pickem.redditcfb.com redirect to Reddit post

---

## 12. Test plan

- [ ] Mod loads D1 games from scoreboard API (FBS + FCS)
- [ ] Mod selects 10; slate rejected if ≠ 10
- [ ] Post shows 10 games + top 10 standings
- [ ] User submits picks with unique points 1–10
- [ ] User blocked after kickoff (422)
- [ ] Unselected games at kickoff get lowest points (server-side reshuffle)
- [ ] Final games update season totals
- [ ] Week multiplier on bowl weeks
- [ ] Canceled game awards all pickers
- [ ] Leaderboard handles ties (competition rank)
- [ ] CDN logos render in Devvit post
- [ ] Logged-out users can view; only logged-in Reddit users can pick

---

## 13. Open decisions

| Question | Recommendation |
|----------|----------------|
| Migrate existing `pickem.scores`? | Yes if same season; mod chooses cutover week |
| Devvit post type mechanics | Custom post / interactive post — use current Devvit best practice |
| Live score polling in post | Phase 4 nice-to-have |
| Prize eligibility | Out of app scope v1; link to rules thread |

---

## 14. Quick reference

| Resource | URL |
|----------|-----|
| Scoreboard API | `https://scoreboard.redditcfb.com/api/v1` |
| Scoreboard handoff | `SCOREBOARD_HANDOFF.md` (this repo) |
| Mods API base | `https://mods.redditcfb.com/api/devvit/v1` |
| Mods API patterns | `redditcfb.com/docs/DEVVIT_APP_API_STATUS.md` |
| Legacy pick'em | `https://pickem.redditcfb.com` |
| Team logos | `https://cdn.redditcfb.com/60x40/cfb/{slug}.png` |
| Official group id | `6` |

---

*Prerequisite: deploy scoreboard `GET /api/v1/games` to production before end-to-end Devvit testing. Picks require mods API `/pickem/*` routes on redditcfb.com — coordinate with that workstream in parallel.*
