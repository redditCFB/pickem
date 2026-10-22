import { Hono } from 'hono';
import type { OnAppInstallRequest, TriggerResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';

export const triggers = new Hono();

triggers.post('/on-app-install', async (c) => {
  await c.req.json<OnAppInstallRequest>();

  return c.json<TriggerResponse>(
    {
      status: 'success',
      message: `Pick 'Em installed in r/${context.subredditName}. Use mod menu → Publish Pick 'Em Post, then open the post → Setup tab to choose games.`,
    },
    200
  );
});
