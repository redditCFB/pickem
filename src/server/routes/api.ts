import { Hono } from 'hono';
import { context, reddit } from '@devvit/web/server';
import { CDN_LOGO_BASE } from '../../shared/constants';
import type {
  ApiError,
  BootstrapResponse,
  PicksResponse,
  SavePicksRequest,
  SavePicksResponse,
  SlateResponse,
  SplashResponse,
} from '../../shared/api';
import { draftToSubmissions, reshuffleUnselectedPicks } from '../../shared/pickLogic';
import type { DraftPick } from '../../shared/pickLogic';
import * as dataService from '../lib/dataService';

type ErrorResponse = ApiError;

export const api = new Hono();

const requirePostId = (): string | null => context.postId ?? null;

const requireUsername = async (): Promise<string | null> => {
  const username = await reddit.getCurrentUsername();
  return username ?? null;
};

/** One round trip: binding, slate, picks, meta. */
api.get('/bootstrap', async (c) => {
  const postId = requirePostId();
  if (!postId) {
    return c.json<ErrorResponse>(
      { status: 'error', message: 'postId is required' },
      400
    );
  }

  try {
    const username = await reddit.getCurrentUsername();
    const data = await dataService.loadBootstrap(postId, username ?? null);
    if (!data) {
      return c.json<ErrorResponse>(
        { status: 'error', message: 'No slate configured for this post' },
        404
      );
    }

    return c.json<BootstrapResponse>({
      type: 'bootstrap',
      ...data,
    });
  } catch (error) {
    console.error('Bootstrap error:', error);
    return c.json<ErrorResponse>(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to load',
      },
      500
    );
  }
});

/** Inline feed preview — no scoreboard or standings fetch. */
api.get('/splash', async (c) => {
  const postId = requirePostId();
  if (!postId) {
    return c.json<ErrorResponse>(
      { status: 'error', message: 'postId is required' },
      400
    );
  }

  try {
    const data = await dataService.loadSplash(postId);
    if (!data) {
      return c.json<ErrorResponse>(
        { status: 'error', message: 'No slate configured for this post' },
        404
      );
    }

    return c.json<SplashResponse>({
      type: 'splash',
      ...data,
    });
  } catch (error) {
    console.error('Splash error:', error);
    return c.json<ErrorResponse>(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to load',
      },
      500
    );
  }
});

/** Live score refresh during games (uses slate cache unless ?refresh=1). */
api.get('/slate', async (c) => {
  const postId = requirePostId();
  if (!postId) {
    return c.json<ErrorResponse>(
      { status: 'error', message: 'postId is required' },
      400
    );
  }

  try {
    const binding = await dataService.resolveBinding(postId);
    if (!binding) {
      return c.json<ErrorResponse>(
        { status: 'error', message: 'No slate configured for this post' },
        404
      );
    }

    const bypassCache = c.req.query('refresh') === '1';
    const slate = await dataService.getSlateGames(binding, { bypassCache });
    return c.json<SlateResponse>({
      type: 'slate',
      games: slate.games,
      binding,
      liveScoreboard: slate.liveScoreboard,
      gamesError: slate.gamesError,
      gamesCachedAt: slate.gamesCachedAt,
      scoreboardStale: slate.scoreboardStale,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Slate error:', error);
    return c.json<ErrorResponse>(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to load slate',
      },
      500
    );
  }
});

api.get('/picks/me', async (c) => {
  const postId = requirePostId();
  const username = await requireUsername();

  if (!postId) {
    return c.json<ErrorResponse>(
      { status: 'error', message: 'postId is required' },
      400
    );
  }

  if (!username) {
    return c.json<ErrorResponse>(
      { status: 'error', message: 'You must be logged in to view picks' },
      401
    );
  }

  try {
    const binding = await dataService.resolveBinding(postId);
    if (!binding) {
      return c.json<ErrorResponse>(
        { status: 'error', message: 'No slate configured for this post' },
        404
      );
    }

    const { games } = await dataService.getSlateGames(binding);
    const result = await dataService.getUserPicks(binding, username, games);
    return c.json<PicksResponse>({
      type: 'picks',
      picks: result.picks,
      seasonTotal: result.seasonTotal,
      pendingSync: result.pendingSync,
    });
  } catch (error) {
    console.error('Picks fetch error:', error);
    return c.json<ErrorResponse>(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to load picks',
      },
      500
    );
  }
});

api.put('/picks', async (c) => {
  const postId = requirePostId();
  const username = await requireUsername();

  if (!postId) {
    return c.json<ErrorResponse>(
      { status: 'error', message: 'postId is required' },
      400
    );
  }

  if (!username) {
    return c.json<ErrorResponse>(
      { status: 'error', message: 'You must be logged in to submit picks' },
      401
    );
  }

  try {
    const body = await c.req.json<SavePicksRequest>();
    const binding = await dataService.resolveBinding(postId);
    if (!binding) {
      return c.json<ErrorResponse>(
        { status: 'error', message: 'No slate configured for this post' },
        404
      );
    }

    const { games } = await dataService.getSlateGames(binding);
    const result = await dataService.saveUserPicks(
      binding,
      username,
      body.picks,
      games
    );

    return c.json<SavePicksResponse>({
      type: 'saved',
      picks: result.picks,
      seasonTotal: result.seasonTotal,
      pendingSync: result.pendingSync,
    });
  } catch (error) {
    console.error('Save picks error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to save picks';
    const status = message.includes('locked') ? 422 : 400;
    return c.json<ErrorResponse>({ status: 'error', message }, status);
  }
});

api.post('/picks/reshuffle', async (c) => {
  const postId = requirePostId();
  if (!postId) {
    return c.json<ErrorResponse>(
      { status: 'error', message: 'postId is required' },
      400
    );
  }

  try {
    const body = await c.req.json<{ draft: DraftPick[] }>();
    const binding = await dataService.resolveBinding(postId);
    if (!binding) {
      return c.json<ErrorResponse>(
        { status: 'error', message: 'No slate configured for this post' },
        404
      );
    }

    const { games } = await dataService.getSlateGames(binding);
    const reshuffled = reshuffleUnselectedPicks(body.draft, games);
    const picks = draftToSubmissions(reshuffled);

    return c.json({ type: 'reshuffled', picks, draft: reshuffled });
  } catch (error) {
    console.error('Reshuffle error:', error);
    return c.json<ErrorResponse>(
      {
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to reshuffle picks',
      },
      500
    );
  }
});

const SLUG_PATTERN = /^[a-z0-9-]+$/i;

/** Proxy CDN logos — external img src is blocked in Devvit webviews. */
api.get('/logo/:slug', async (c) => {
  const slug = c.req.param('slug');
  if (!SLUG_PATTERN.test(slug)) {
    return c.text('Invalid slug', 400);
  }

  try {
    const res = await fetch(`${CDN_LOGO_BASE}/${slug}.png`);
    if (!res.ok) {
      return c.text('Logo not found', res.status === 404 ? 404 : 502);
    }

    const body = await res.arrayBuffer();
    return c.body(body, 200, {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    });
  } catch (error) {
    console.error('Logo proxy error:', error);
    return c.text('Failed to load logo', 502);
  }
});
