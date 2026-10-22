import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import * as dataService from '../lib/dataService';

export const menu = new Hono();

menu.post('/publish-pickem', async (c) => {
  try {
    const meta = await dataService.getMeta();

    return c.json<UiResponse>({
      showForm: {
        name: 'publishPickem',
        form: {
          title: "Publish Pick 'Em Post",
          description:
            'Enter the season and week to publish the Pick \'Em post (slate must already be configured).',
          acceptLabel: 'Publish',
          cancelLabel: 'Cancel',
          fields: [
            {
              type: 'string',
              name: 'season',
              label: 'Season',
              required: true,
              defaultValue: meta.current_season,
            },
            {
              type: 'number',
              name: 'week',
              label: 'Week',
              required: true,
              defaultValue: meta.current_week,
            },
          ],
        },
      },
    });
  } catch (error) {
    console.error('Publish menu error:', error);
    return c.json<UiResponse>(
      { showToast: 'Failed to open publish form' },
      400
    );
  }
});
