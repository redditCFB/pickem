import { context, redis, reddit } from '@devvit/web/server';

const MOD_SETUP_POST_KEY = 'mod:setupPostId';

export const openModSetupPost = async () => {
  const subredditName = context.subredditName ?? 'unknown';
  const existingId = await redis.get(MOD_SETUP_POST_KEY);

  if (existingId) {
    return {
      postId: existingId,
      postUrl: `https://reddit.com/r/${subredditName}/comments/${existingId}`,
    };
  }

  const post = await reddit.submitCustomPost({
    title: "Pick 'Em — Mod Slate Setup",
    entry: 'mod-setup',
    textFallback: {
      text: 'Moderators: configure the weekly Pick Em slate here.',
    },
  });

  await redis.set(MOD_SETUP_POST_KEY, post.id);

  return {
    postId: post.id,
    postUrl: `https://reddit.com/r/${subredditName}/comments/${post.id}`,
  };
};
