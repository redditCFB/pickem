import { reddit } from '@devvit/web/server';
import type { PostBinding } from '../../shared/types';

export const createPickemPost = async (binding: PostBinding) => {
  const gameCount = binding.slate_game_ids.length;
  const pointsHint =
    gameCount > 0
      ? `Assign confidence points 1–${gameCount} (${gameCount} = most confident).`
      : 'Assign confidence points to each game (highest = most confident).';

  const body = `# Week ${binding.week} Pick 'Em

Make your picks below! ${pointsHint}

---

**[Make your picks](#)** — tap to expand and submit before kickoff.`;

  const post = await reddit.submitCustomPost({
    title: `Week ${binding.week} Pick 'Em`,
    textFallback: { text: body },
  });

  return post;
};
