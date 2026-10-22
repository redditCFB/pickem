import { context } from '@devvit/web/server';

/** Subreddits where mock scoreboard data is allowed when backends are unreachable. */
const PLAYTEST_SUBREDDITS = new Set(['pickem_game_dev']);

export const isPlaytestSubreddit = (): boolean => {
  const raw = context.subredditName?.trim().toLowerCase();
  if (!raw) {
    return false;
  }
  const name = raw.startsWith('r/') ? raw.slice(2) : raw;
  return PLAYTEST_SUBREDDITS.has(name);
};
