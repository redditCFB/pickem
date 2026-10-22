import { OFFICIAL_GROUP_ID } from '../../shared/constants';
import { settings } from '@devvit/web/server';

/** Per-subreddit pickem.groups.id from pickem.redditcfb.com (default: Official RedditCFB). */
export const getPickemGroupId = async (): Promise<number> => {
  const value = await settings.get<number>('pickemGroupId');
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.trunc(value);
  }
  return OFFICIAL_GROUP_ID;
};
