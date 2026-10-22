# Privacy Policy — Pick 'Em (pickem-game)

**Effective date:** [DATE]  
**Last updated:** [DATE]

This Privacy Policy describes how the **Pick 'Em** Devvit application (“**App**”, slug: `pickem-game`) collects, uses, and shares information when you use the App inside a Reddit subreddit that has installed it.

The App is operated by the **redditcfb.com** pick'em team (“**we**”, “**us**”, “**our**”) in connection with the college football community on Reddit (including r/CFB). Contact: [CONTACT EMAIL].

Your use of Reddit is also governed by [Reddit’s Privacy Policy](https://www.reddit.com/policies/privacy-policy) and [User Agreement](https://www.reddit.com/policies/user-agreement).

---

## 1. What the App does

Pick 'Em is a weekly confidence-based pick'em game. Moderators configure a slate of games; logged-in Reddit users submit picks and view standings inside a Reddit custom post.

The App runs on **Reddit’s Devvit platform**. Our servers (redditcfb.com infrastructure) provide game data, team logos, and long-term pick/standings storage.

---

## 2. Information we collect

### 2.1 Information from Reddit (via Devvit)

When you interact with the App, Reddit’s Devvit platform provides us with limited account context, including:

| Data | Purpose |
|------|---------|
| **Reddit username** | Identify your picks and standings row |
| **Login state** | Determine whether you can submit picks |
| **Subreddit name** | Scope the App to the installing community |
| **Post ID** | Load the correct weekly slate for that post |
| **Moderator status** | Restrict mod-only tools (slate setup, publish) |

We do **not** receive your Reddit password, email address, or private messages through this App.

### 2.2 Information you provide

| Data | Purpose |
|------|---------|
| **Pick choices** (team selected per game) | Run the pick'em contest |
| **Confidence points** (1–10 per game) | Score the contest |
| **Mod slate configuration** (season, week, game IDs) | Define the weekly slate |

### 2.3 Information collected automatically

| Data | Purpose |
|------|---------|
| **App/server logs** (errors, timestamps) | Operate and debug the service |
| **Cached game/score data** | Display schedules, kickoffs, and live scores |

We do not use the App to collect precise geolocation, device advertising IDs, or browser history.

---

## 3. How we use information

We use the information above to:

- Display games, logos, scores, and standings  
- Save and retrieve your picks for the active season/week  
- Compute leaderboard rankings  
- Allow moderators to configure and publish weekly slates  
- Maintain security and prevent abuse of mod endpoints  

We do **not** sell your personal information. We do **not** use your data for third-party advertising inside the App.

---

## 4. Where data is stored and processed

Data may be stored in:

| Location | What | When |
|----------|------|------|
| **Reddit Devvit Redis** | Draft slates, post bindings, demo-mode picks | Always (platform storage) |
| **mods.redditcfb.com → MySQL** | Picks, standings, slate (production) | When external API is enabled |
| **scoreboard.redditcfb.com** | Public game schedule/score JSON (read-only) | Fetched server-side; no user profile stored there |
| **cdn.redditcfb.com** | Team logo images | Fetched server-side and proxied to the App |

Server-side requests to redditcfb.com domains use HTTPS. Authenticated calls to the mods API use a secret token stored in Reddit Devvit app settings (not exposed to users).

---

## 5. What we share

We share information only as needed to operate the App:

| Recipient | Shared data | Why |
|-----------|-------------|-----|
| **Reddit / Devvit** | App runs on their platform | Hosting and authentication |
| **redditcfb.com backends** | Username, picks, standings | Contest operation (legacy pickem database) |
| **Other players / subreddit** | Username and scores on **public standings** | Nature of the game |

We may disclose information if required by law or to protect the service, users, or the public.

---

## 6. Data retention

- **Picks and standings** are retained for the active pick'em season and historical seasons consistent with redditcfb.com pick'em practices.  
- **Devvit Redis** data (draft slates, post bindings) persists until overwritten or the App is removed from a subreddit.  
- **Server logs** are retained for a limited operational period ([e.g. 30–90 days]) then deleted or aggregated.

---

## 7. Your choices and rights

- **View picks:** Use the App while logged in to Reddit.  
- **Change picks:** Allowed until games lock at kickoff (per game rules).  
- **Delete picks / account data:** Contact [CONTACT EMAIL] with your Reddit username and subreddit. We will delete or anonymize pick'em records where feasible.  
- **Stop using the App:** Do not open the post or submit picks. Removing the App from a subreddit is a moderator action.

Depending on your jurisdiction, you may have additional privacy rights (access, correction, deletion). Contact us at [CONTACT EMAIL].

---

## 8. Security

We use HTTPS, authenticated server-to-server calls for the mods API, and moderator checks on sensitive endpoints. No method of transmission or storage is 100% secure.

---

## 9. Children

The App is intended for general Reddit audiences. It is not directed at children under 13. If you believe a child has provided personal information, contact [CONTACT EMAIL].

---

## 10. International users

Our infrastructure is operated from the United States. By using the App, you understand that information may be processed in the U.S.

---

## 11. Changes

We may update this Privacy Policy. We will revise the “Last updated” date. Material changes may be noted in the subreddit or App where practical.

---

## 12. Contact

**Email:** [CONTACT EMAIL]  
**Web:** [https://pickem.redditcfb.com](https://pickem.redditcfb.com) (or [https://redditcfb.com](https://redditcfb.com))

---

## Summary for Reddit App Review (HTTP fetch)

This App’s server fetches:

| Domain | Data exchanged |
|--------|----------------|
| `scoreboard.redditcfb.com` | Public game metadata and scores (no Reddit user identifiers) |
| `cdn.redditcfb.com` | Public team logo PNG files (no user data) |
| `mods.redditcfb.com` | Reddit **username**, pick submissions, standings reads/writes (Bearer-authenticated server-side only) |

User-facing images are served via our own `/api/logo/` proxy; the client webview does not load external CDN URLs directly.
