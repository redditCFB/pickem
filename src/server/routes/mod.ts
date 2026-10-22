import { Hono } from 'hono';
import { context } from '@devvit/web/server';
import type {
  ApiError,
  GamePoolResponse,
  ModSlateResponse,
  PublishPostRequest,
  PublishPostResponse,
  SaveSlateRequest,
  SaveSlateResponse,
} from '../../shared/api';
import { slateSizeError } from '../../shared/constants';
import * as dataService from '../lib/dataService';
import { isCurrentUserModerator } from '../lib/moderator';
import { setPostBinding } from '../lib/postBinding';
import { getInAppSlateConfig } from '../lib/subredditConfig';

type ErrorResponse = ApiError;

export const mod = new Hono();

const requireModSlateAccess = async (): Promise<ErrorResponse | null> => {
  if (!(await getInAppSlateConfig())) {
    return {
      status: 'error',
      message: 'In-app slate configuration is disabled for this subreddit.',
    };
  }

  if (!(await isCurrentUserModerator())) {
    return { status: 'error', message: 'Moderator access required.' };
  }

  return null;
};

const parseSeason = (raw: string | undefined): string | null => {
  if (raw === undefined) {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed === '' ? null : trimmed;
};

const parseWeek = (raw: string | undefined): number | null => {
  if (raw === undefined || raw === '') {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
};

mod.get('/pool', async (c) => {
  const denied = await requireModSlateAccess();
  if (denied) {
    return c.json(denied, 403);
  }

  try {
    const seasonParam = c.req.query('season');
    const weekParam = c.req.query('week');
    const meta = await dataService.getMeta();
    const season = parseSeason(seasonParam) ?? meta.current_season;
    const week = parseWeek(weekParam ?? undefined) ?? meta.current_week;
    const games = await dataService.getGamePool(season, week);

    return c.json<GamePoolResponse>({
      type: 'pool',
      games,
      meta: { current_season: season, current_week: week },
    });
  } catch (error) {
    console.error('Mod pool error:', error);
    return c.json<ErrorResponse>(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to load games',
      },
      500
    );
  }
});

mod.get('/slate', async (c) => {
  const denied = await requireModSlateAccess();
  if (denied) {
    return c.json(denied, 403);
  }

  try {
    const meta = await dataService.getMeta();
    const season = parseSeason(c.req.query('season')) ?? meta.current_season;
    const week = parseWeek(c.req.query('week') ?? undefined) ?? meta.current_week;
    const gameIds = await dataService.fetchModSlate(season, week);

    return c.json<ModSlateResponse>({
      type: 'mod_slate',
      season,
      week,
      game_ids: gameIds,
    });
  } catch (error) {
    console.error('Mod slate GET error:', error);
    return c.json<ErrorResponse>(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to load slate',
      },
      500
    );
  }
});

mod.put('/slate', async (c) => {
  const denied = await requireModSlateAccess();
  if (denied) {
    return c.json(denied, 403);
  }

  try {
    const body = await c.req.json<SaveSlateRequest>();
    const season = parseSeason(body.season);
    const week = typeof body.week === 'number' ? Math.trunc(body.week) : null;

    if (season === null || week === null || !Array.isArray(body.game_ids)) {
      return c.json<ErrorResponse>(
        { status: 'error', message: 'season, week, and game_ids are required' },
        400
      );
    }

    const slateError = slateSizeError(body.game_ids.length);
    if (slateError) {
      return c.json<ErrorResponse>(
        {
          status: 'error',
          message: slateError,
        },
        400
      );
    }

    const binding = await dataService.saveModSlate(season, week, body.game_ids);

    const postId = context.postId;
    if (postId) {
      await setPostBinding(postId, binding);
    }

    return c.json<SaveSlateResponse>({
      type: 'slate_saved',
      binding,
    });
  } catch (error) {
    console.error('Mod slate PUT error:', error);
    return c.json<ErrorResponse>(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to save slate',
      },
      400
    );
  }
});

mod.post('/publish', async (c) => {
  const denied = await requireModSlateAccess();
  if (denied) {
    return c.json(denied, 403);
  }

  try {
    const body = await c.req.json<PublishPostRequest>();
    const season = parseSeason(body.season);
    const week = typeof body.week === 'number' ? Math.trunc(body.week) : null;

    if (season === null || week === null) {
      return c.json<ErrorResponse>(
        { status: 'error', message: 'season and week are required' },
        400
      );
    }

    const gameIds = body.game_ids;
    if (gameIds !== undefined) {
      const slateError = slateSizeError(gameIds.length);
      if (slateError) {
        return c.json<ErrorResponse>(
          {
            status: 'error',
            message: `${slateError} before publishing`,
          },
          400
        );
      }
      await dataService.saveModSlate(season, week, gameIds);
    }

    const result = await dataService.publishPickemPost(season, week);
    const subreddit = context.subredditName ?? 'unknown';

    return c.json<PublishPostResponse>({
      type: 'published',
      postId: result.postId,
      postUrl: `https://reddit.com/r/${subreddit}/comments/${result.postId}`,
    });
  } catch (error) {
    console.error('Mod publish error:', error);
    return c.json<ErrorResponse>(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Publish failed',
      },
      400
    );
  }
});
