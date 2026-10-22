import { reddit } from '@devvit/web/server';

export const isCurrentUserModerator = async (): Promise<boolean> => {
  try {
    const [username, subreddit] = await Promise.all([
      reddit.getCurrentUsername(),
      reddit.getCurrentSubreddit(),
    ]);
    if (!username) {
      return false;
    }

    const mods = await subreddit.getModerators().all();
    return mods.some(
      (mod) => mod.username.toLowerCase() === username.toLowerCase()
    );
  } catch {
    return false;
  }
};
