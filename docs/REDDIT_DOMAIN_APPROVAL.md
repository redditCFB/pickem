# Pick 'Em — HTTP Domain Approval Request

**Application:** pickem-game  
**Operator:** redditcfb.com (registered LLC), r/CFB moderation team  
**August 2026**

---

## About Pick 'Em

Pick 'Em is the weekly college football confidence pick'em game for r/CFB and partner communities. The same team has operated [pickem.redditcfb.com](https://pickem.redditcfb.com) and related redditcfb tools for more than fifteen years.

This Devvit app lets members make picks and view standings inside a Reddit post. It is the same contest users already know—free, community-run, and for entertainment only.

---

## Domains requested

We request approval for three HTTPS domains. **All communication is server-side only.** The in-app webview does not contact external domains directly.

**scoreboard.redditcfb.com**

Public game schedules, kickoff times, and live scores. No Reddit user information is sent to this service.

**cdn.redditcfb.com**

Team logo images. Our app server retrieves logos and serves them to the webview through our own endpoints (Devvit cannot display external images directly). No user data is involved.

**mods.redditcfb.com**

Stores player picks and season standings in the **same database** that powers pickem.redditcfb.com today. Only a Reddit username and pick selections are transmitted over HTTPS, using a private server credential stored in app settings—not shared with users.

---

## Why mods.redditcfb.com (gradual transition)

We expect questions about why the Devvit app needs write access to our backend. The short answer: **we are not replacing pickem.redditcfb.com.** We are adding a new way to participate while keeping one contest, one leaderboard, and one season history.

**Backwards compatibility.** Tens of thousands of players already use pickem.redditcfb.com each season. Many will continue to do so. Connecting the Devvit app to our existing pick'em database means:

- Picks made in Reddit and picks made on the website **count toward the same standings**
- Moderators do not run two parallel contests or reconcile two sets of results
- Historical records, scoring jobs, and prize eligibility stay on the system the community has trusted for years

**A gradual rollout, not a hard cutover.** Our plan is to offer Pick 'Em inside Reddit for members who want that experience, while the website remains available for anyone who prefers it—including members who are not comfortable with newer Reddit interfaces. Over time, the community can adopt the Devvit experience at its own pace. Until then, both paths feed the same backend.

**The alternative is worse for users.** Without mods.redditcfb.com, we would need a separate datastore for Devvit-only picks. That would split the player base, duplicate moderator work, and produce conflicting leaderboards. Using our existing API is the smallest, safest change that serves the largest number of players during the transition.

mods.redditcfb.com is not a new third-party service—it is our own infrastructure, already operated for r/CFB, with the same privacy practices documented above.

---

## Privacy and terms

Privacy Policy: https://pickem.redditcfb.com/legal/privacy.html

Terms of Use: https://pickem.redditcfb.com/legal/terms.html

Both are linked in our [Developer Portal app settings](https://developers.reddit.com/apps/pickem-game).

---

## About redditcfb.com

redditcfb.com is established r/CFB community infrastructure: pick'em, the live scoreboard, awards, polls, and other fan tools. We are a registered LLC with public legal pages on our own domain.

The Devvit app uses backends we already operate. We do not sell user data, show in-app advertising, or collect email, device identifiers, or private messages through Pick 'Em.

---

## Request

Please approve HTTP fetch access for:

- scoreboard.redditcfb.com
- cdn.redditcfb.com
- mods.redditcfb.com

for the **pickem-game** application.

**Contact:** [r/CFB moderator mail](https://www.reddit.com/message/compose/?to=/r/CFB) (subject: Pick 'Em domain review)
