import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import * as dataService from '../lib/dataService';
import { createPickemPost } from '../core/post';
import { setLastPublishedPostId, setPostBinding } from '../lib/postBinding';

export const forms = new Hono();

type PublishFormValues = {
  season?: string;
  week?: number | string;
};

const parseFormSeason = (value: string | undefined): string | null => {
  if (value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

const parseFormInt = (value: number | string | undefined): number | null => {
  if (value === undefined || value === '') {
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
};

const postUrl = (postId: string): string =>
  `https://reddit.com/r/${context.subredditName ?? 'unknown'}/comments/${postId}`;

forms.post('/publish-pickem', async (c) => {
  try {
    const body = await c.req.json<PublishFormValues>();
    const season = parseFormSeason(
      body.season !== undefined ? String(body.season) : undefined
    );
    const week = parseFormInt(body.week);

    if (season === null || week === null) {
      return c.json<UiResponse>(
        {
          showToast: 'Season and week are required.',
        },
        400
      );
    }

    const binding = await dataService.createBindingForPublish(season, week);
    const post = await createPickemPost(binding);
    await setPostBinding(post.id, binding);
    await setLastPublishedPostId(post.id);

    return c.json<UiResponse>({
      navigateTo: postUrl(post.id),
      showToast: {
        text: `Week ${week} Pick 'Em post published!`,
        appearance: 'success',
      },
    });
  } catch (error) {
    console.error('Publish form error:', error);
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to publish Pick Em post';

    return c.json<UiResponse>({ showToast: message }, 400);
  }
});
