import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import type {
  ApiError,
  BootstrapResponse,
  GamePoolResponse,
  ModSlateResponse,
  PublishPostResponse,
  SavePicksRequest,
  SavePicksResponse,
  SaveSlateRequest,
  SaveSlateResponse,
  SlateResponse,
  SplashResponse,
} from '../src/shared/api';
import {
  CDN_LOGO_BASE,
  OFFICIAL_GROUP_ID,
  slateSizeError,
} from '../src/shared/constants';
import type { Game, PostBinding, UserPick } from '../src/shared/types';
import {
  mockGamePool,
  mockMeta,
  mockSeasonTotal,
  mockSlateGames,
  mockUserPicks,
} from '../src/server/lib/mockData';

type Viewer = 'mod' | 'member' | 'logged-out';
type Next = (err?: unknown) => void;

const SLUG_PATTERN = /^[a-z0-9-]+$/i;
const LOCAL_POST_ID = 'local-post';

const clonePicks = (source: readonly UserPick[]): UserPick[] =>
  source.map((pick) => ({ ...pick }));

let picks: UserPick[] = clonePicks(mockUserPicks);
let slateIds: string[] = mockSlateGames.map((game) => game.id);
let season = mockMeta.current_season;
let week = mockMeta.current_week;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const binding = (): PostBinding => ({
  season,
  week,
  group_id: OFFICIAL_GROUP_ID,
  slate_game_ids: [...slateIds],
});

const slateGames = (): Game[] =>
  slateIds.flatMap((id) => {
    const game = mockGamePool.find((candidate) => candidate.id === id);
    return game ? [game] : [];
  });

const picksForSlate = (): UserPick[] => {
  const allowed = new Set(slateIds);
  return picks.filter((pick) => allowed.has(pick.game_id));
};

const viewerFrom = (req: IncomingMessage): Viewer => {
  const referer = req.headers.referer;
  if (!referer) {
    return 'mod';
  }

  try {
    const as = new URL(referer).searchParams.get('as');
    if (as === 'member' || as === 'logged-out') {
      return as;
    }
  } catch {
    return 'mod';
  }

  return 'mod';
};

const usernameFor = (viewer: Viewer): string | null => {
  if (viewer === 'logged-out') return null;
  if (viewer === 'member') return 'local_fan';
  return 'local_mod';
};

const readBody = (req: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer | string) => {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    });
    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', reject);
  });

const parseJson = (raw: string): unknown => {
  if (raw.trim() === '') return {};
  return JSON.parse(raw);
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const isSavePicks = (value: unknown): value is SavePicksRequest => {
  if (!isRecord(value) || !isStringPickList(value.picks)) {
    return false;
  }
  return true;
};

const isStringPickList = (value: unknown): value is SavePicksRequest['picks'] => {
  if (!Array.isArray(value)) return false;
  return value.every(
    (pick) =>
      isRecord(pick) &&
      typeof pick.game_id === 'string' &&
      typeof pick.pick === 'string' &&
      typeof pick.points === 'number'
  );
};

const isSaveSlate = (value: unknown): value is SaveSlateRequest =>
  isRecord(value) &&
  typeof value.season === 'string' &&
  typeof value.week === 'number' &&
  isStringArray(value.game_ids);

const isPublishBody = (
  value: unknown
): value is { season: string; week: number; game_ids?: string[] } => {
  if (!isRecord(value)) return false;
  if (typeof value.season !== 'string' || typeof value.week !== 'number') {
    return false;
  }
  return value.game_ids === undefined || isStringArray(value.game_ids);
};

const sendJson = (res: ServerResponse, status: number, body: unknown): void => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
};

const sendError = (res: ServerResponse, status: number, message: string): void => {
  const body: ApiError = { status: 'error', message };
  sendJson(res, status, body);
};

const applySlate = (
  nextSeason: string,
  nextWeek: number,
  gameIds: readonly string[]
): string | null => {
  const error = slateSizeError(gameIds.length);
  if (error) return error;
  season = nextSeason;
  week = nextWeek;
  slateIds = [...gameIds];
  const allowed = new Set(slateIds);
  picks = picks.filter((pick) => allowed.has(pick.game_id));
  return null;
};

const requestedMeta = (url: URL): { current_season: string; current_week: number } => {
  const seasonParam = url.searchParams.get('season');
  const weekParam = url.searchParams.get('week');
  const parsedWeek =
    weekParam === null || weekParam === '' ? null : Number(weekParam);

  return {
    current_season:
      seasonParam !== null && seasonParam.trim() !== ''
        ? seasonParam.trim()
        : season,
    current_week:
      parsedWeek !== null && Number.isFinite(parsedWeek)
        ? Math.trunc(parsedWeek)
        : week,
  };
};

const requireMod = (res: ServerResponse, viewer: Viewer): boolean => {
  if (viewer === 'mod') return true;
  sendError(res, 403, 'Moderator access required.');
  return false;
};

const handleLogo = async (
  res: ServerResponse,
  slug: string
): Promise<void> => {
  const decoded = decodeURIComponent(slug);
  if (!SLUG_PATTERN.test(decoded)) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Invalid slug');
    return;
  }

  try {
    const logo = await fetch(`${CDN_LOGO_BASE}/${decoded}.png`);
    if (!logo.ok) {
      res.statusCode = logo.status === 404 ? 404 : 502;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Logo not found');
      return;
    }

    const body = Buffer.from(await logo.arrayBuffer());
    res.statusCode = 200;
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.end(body);
  } catch (error) {
    console.error('Local logo proxy error:', error);
    res.statusCode = 502;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Failed to load logo');
  }
};

const handleApi = async (
  req: IncomingMessage,
  res: ServerResponse,
  url: URL
): Promise<void> => {
  const viewer = viewerFrom(req);
  const method = req.method ?? 'GET';
  const path = url.pathname;

  if (method === 'GET' && path === '/api/bootstrap') {
    const loggedIn = viewer !== 'logged-out';
    const games = slateGames();
    const body: BootstrapResponse = {
      type: 'bootstrap',
      postId: LOCAL_POST_ID,
      username: usernameFor(viewer),
      isLoggedIn: loggedIn,
      isModerator: viewer === 'mod',
      inAppSlateConfig: true,
      binding: binding(),
      meta: { current_season: season, current_week: week },
      modsAvailable: true,
      playtestMode: true,
      liveScoreboard: true,
      games,
      gamesError: null,
      gamesCachedAt: null,
      scoreboardStale: false,
      picks: loggedIn ? picksForSlate() : [],
      seasonTotal: loggedIn ? mockSeasonTotal : null,
      picksPendingSync: false,
      fetchedAt: new Date().toISOString(),
    };
    sendJson(res, 200, body);
    return;
  }

  if (method === 'GET' && path === '/api/splash') {
    const body: SplashResponse = {
      type: 'splash',
      binding: binding(),
      gameCount: slateIds.length,
      modsAvailable: true,
      playtestMode: true,
    };
    sendJson(res, 200, body);
    return;
  }

  if (method === 'GET' && path === '/api/slate') {
    const body: SlateResponse = {
      type: 'slate',
      games: slateGames(),
      binding: binding(),
      liveScoreboard: true,
      gamesError: null,
      gamesCachedAt: null,
      scoreboardStale: false,
      fetchedAt: new Date().toISOString(),
    };
    sendJson(res, 200, body);
    return;
  }

  if (method === 'PUT' && path === '/api/picks') {
    if (viewer === 'logged-out') {
      sendError(res, 401, 'You must be logged in to submit picks');
      return;
    }

    let parsed: unknown;
    try {
      parsed = parseJson(await readBody(req));
    } catch {
      sendError(res, 400, 'Invalid JSON');
      return;
    }

    if (!isSavePicks(parsed)) {
      sendError(res, 400, 'picks are required');
      return;
    }

    picks = parsed.picks.map((pick) => ({
      game_id: pick.game_id,
      pick: pick.pick,
      points: pick.points,
      is_correct: null,
      points_earned: null,
    }));

    const body: SavePicksResponse = {
      type: 'saved',
      picks: picksForSlate(),
      seasonTotal: mockSeasonTotal,
      pendingSync: false,
    };
    sendJson(res, 200, body);
    return;
  }

  const logoMatch = /^\/api\/logo\/([^/]+)$/.exec(path);
  const logoSlug = logoMatch?.[1];
  if (method === 'GET' && logoSlug) {
    await handleLogo(res, logoSlug);
    return;
  }

  if (path === '/api/mod/pool' && method === 'GET') {
    if (!requireMod(res, viewer)) return;
    const body: GamePoolResponse = {
      type: 'pool',
      games: mockGamePool,
      meta: requestedMeta(url),
    };
    sendJson(res, 200, body);
    return;
  }

  if (path === '/api/mod/slate' && method === 'GET') {
    if (!requireMod(res, viewer)) return;
    const meta = requestedMeta(url);
    const body: ModSlateResponse = {
      type: 'mod_slate',
      season: meta.current_season,
      week: meta.current_week,
      game_ids: [...slateIds],
    };
    sendJson(res, 200, body);
    return;
  }

  if (path === '/api/mod/slate' && method === 'PUT') {
    if (!requireMod(res, viewer)) return;

    let parsed: unknown;
    try {
      parsed = parseJson(await readBody(req));
    } catch {
      sendError(res, 400, 'Invalid JSON');
      return;
    }

    if (!isSaveSlate(parsed)) {
      sendError(res, 400, 'season, week, and game_ids are required');
      return;
    }

    const slateError = applySlate(parsed.season, parsed.week, parsed.game_ids);
    if (slateError) {
      sendError(res, 400, slateError);
      return;
    }

    const body: SaveSlateResponse = {
      type: 'slate_saved',
      binding: binding(),
    };
    sendJson(res, 200, body);
    return;
  }

  if (path === '/api/mod/publish' && method === 'POST') {
    if (!requireMod(res, viewer)) return;

    let parsed: unknown;
    try {
      parsed = parseJson(await readBody(req));
    } catch {
      sendError(res, 400, 'Invalid JSON');
      return;
    }

    if (!isPublishBody(parsed)) {
      sendError(res, 400, 'season and week are required');
      return;
    }

    if (parsed.game_ids) {
      const slateError = applySlate(parsed.season, parsed.week, parsed.game_ids);
      if (slateError) {
        sendError(res, 400, `${slateError} before publishing`);
        return;
      }
    }

    const body: PublishPostResponse = {
      type: 'published',
      postId: LOCAL_POST_ID,
      postUrl: 'http://localhost:7474/game.html',
    };
    sendJson(res, 200, body);
    return;
  }

  sendError(res, 404, 'Not found');
};

const handleRequest = async (
  req: IncomingMessage,
  res: ServerResponse,
  next: Next
): Promise<void> => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (!url.pathname.startsWith('/api/')) {
    next();
    return;
  }

  await handleApi(req, res, url);
};

export const localClientApi = (): Plugin => ({
  name: 'pickem-local-api',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      void handleRequest(req, res, next).catch((err: unknown) => {
        next(err);
      });
    });
  },
});
