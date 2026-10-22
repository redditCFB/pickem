import { MODS_API_BASE, OFFICIAL_GROUP_ID } from '../../shared/constants';
import { encodePickemSeason } from '../../shared/season';
import type {
  PickemMeta,
  PickSubmission,
  StandingsEntry,
  UserPick,
} from '../../shared/types';
import { settings } from '@devvit/web/server';
import { isPlaytestSubreddit } from './playtest';

type ModsSlateResponse = {
  ok: boolean;
  game_ids?: string[];
  games?: unknown[];
};

type ModsPicksResponse = {
  ok: boolean;
  picks?: UserPick[];
  season_total?: number;
};

type ModsStandingsResponse = {
  ok: boolean;
  items?: StandingsEntry[];
};

type ModsMetaResponse = {
  ok: boolean;
  current_season?: string | number;
  current_week?: number;
};

export class ModsApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'ModsApiError';
  }
}

const getApiSecret = async (): Promise<string | undefined> => {
  const secret = await settings.get<string>('modsApiSecret');
  return secret ?? undefined;
};

const modsFetch = async (
  path: string,
  options: RequestInit = {}
): Promise<Response> => {
  const secret = await getApiSecret();
  if (!secret) {
    throw new ModsApiError(
      'Mods API secret not configured. Run: devvit settings set modsApiSecret',
      503
    );
  }

  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${secret}`);
  headers.set('Content-Type', 'application/json');

  return fetch(`${MODS_API_BASE}${path}`, {
    ...options,
    headers,
  });
};

export const fetchMeta = async (): Promise<PickemMeta> => {
  if (cachedPickemMeta) {
    return cachedPickemMeta;
  }

  const res = await modsFetch('/pickem/meta');
  if (!res.ok) {
    throw new ModsApiError(`Mods API error: ${res.status}`, res.status);
  }

  const data: ModsMetaResponse = await res.json();
  const meta = parseMetaResponse(data);
  if (!meta) {
    throw new ModsApiError('Invalid meta response', 502);
  }

  cachedPickemMeta = meta;
  return meta;
};

export const updateMeta = async (meta: PickemMeta): Promise<void> => {
  const res = await modsFetch('/pickem/meta', {
    method: 'PUT',
    body: JSON.stringify(meta),
  });

  if (!res.ok) {
    throw new ModsApiError(`Failed to update meta: ${res.status}`, res.status);
  }
};

export const fetchSlate = async (
  season: string,
  week: number,
  groupId = OFFICIAL_GROUP_ID
): Promise<string[]> => {
  const res = await modsFetch(
    `/pickem/slate?season=${encodePickemSeason(season)}&week=${week}&group_id=${groupId}`
  );

  if (!res.ok) {
    throw new ModsApiError(`Failed to fetch slate: ${res.status}`, res.status);
  }

  const data: ModsSlateResponse = await res.json();
  if (!data.ok || !data.game_ids) {
    throw new ModsApiError('Invalid slate response', 502);
  }

  return data.game_ids;
};

export const saveSlate = async (
  season: string,
  week: number,
  gameIds: string[],
  groupId = OFFICIAL_GROUP_ID
): Promise<void> => {
  const res = await modsFetch('/pickem/slate', {
    method: 'PUT',
    body: JSON.stringify({
      season,
      week,
      group_id: groupId,
      game_ids: gameIds,
    }),
  });

  if (!res.ok) {
    throw new ModsApiError(`Failed to save slate: ${res.status}`, res.status);
  }
};

export const fetchUserPicks = async (
  season: string,
  week: number,
  username: string,
  groupId = OFFICIAL_GROUP_ID
): Promise<{ picks: UserPick[]; seasonTotal: number | null }> => {
  const res = await modsFetch(
    `/pickem/picks/me?season=${encodePickemSeason(season)}&week=${week}&group_id=${groupId}&username=${encodeURIComponent(username)}`
  );

  if (res.status === 404) {
    return { picks: [], seasonTotal: null };
  }

  if (!res.ok) {
    throw new ModsApiError(`Failed to fetch picks: ${res.status}`, res.status);
  }

  const data: ModsPicksResponse = await res.json();
  return {
    picks: data.picks ?? [],
    seasonTotal: data.season_total ?? null,
  };
};

export const savePicks = async (
  season: string,
  week: number,
  username: string,
  picks: PickSubmission[],
  groupId = OFFICIAL_GROUP_ID
): Promise<{ picks: UserPick[]; seasonTotal: number | null }> => {
  const res = await modsFetch('/pickem/picks', {
    method: 'PUT',
    body: JSON.stringify({
      season,
      week,
      group_id: groupId,
      username,
      picks,
    }),
  });

  if (!res.ok) {
    throw new ModsApiError(`Failed to save picks: ${res.status}`, res.status);
  }

  const data: ModsPicksResponse = await res.json();
  return {
    picks: data.picks ?? [],
    seasonTotal: data.season_total ?? null,
  };
};

export const fetchStandings = async (
  season: string,
  groupId = OFFICIAL_GROUP_ID,
  limit = 50
): Promise<StandingsEntry[]> => {
  const res = await modsFetch(
    `/pickem/standings?season=${encodePickemSeason(season)}&group_id=${groupId}&limit=${limit}`
  );

  if (!res.ok) {
    throw new ModsApiError(
      `Failed to fetch standings: ${res.status}`,
      res.status
    );
  }

  const data: ModsStandingsResponse = await res.json();
  return data.items ?? [];
};

export const fetchTopStandings = async (
  season: string,
  groupId = OFFICIAL_GROUP_ID
): Promise<StandingsEntry[]> => {
  const res = await modsFetch(
    `/pickem/standings/top?season=${encodePickemSeason(season)}&group_id=${groupId}`
  );

  if (!res.ok) {
    throw new ModsApiError(
      `Failed to fetch top standings: ${res.status}`,
      res.status
    );
  }

  const data: ModsStandingsResponse = await res.json();
  return data.items ?? [];
};

export const hasModsApiSecret = async (): Promise<boolean> => {
  const secret = await getApiSecret();
  return Boolean(secret);
};

/** Devvit blocks unapproved custom domains in playtest (gRPC status 7). */
export const isModsHttpBlocked = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('PERMISSION_DENIED') ||
    message.includes('not allowed') ||
    message.includes('status 7')
  );
};

let modsAvailableCached: boolean | null = null;
let cachedPickemMeta: PickemMeta | null = null;

export const clearMockBackendCache = (): void => {
  modsAvailableCached = null;
  cachedPickemMeta = null;
};

const parseMetaResponse = (data: ModsMetaResponse): PickemMeta | null => {
  const season = data.current_season;
  if (
    !data.ok ||
    season === undefined ||
    season === null ||
    String(season).trim() === '' ||
    data.current_week === undefined
  ) {
    return null;
  }

  return {
    current_season: String(season).trim(),
    current_week: data.current_week,
  };
};

/** Whether mods.redditcfb.com responded successfully on the last probe. */
export const isModsApiAvailable = async (): Promise<boolean> => {
  if (!(await hasModsApiSecret())) {
    return false;
  }

  if (modsAvailableCached === true) {
    return true;
  }

  try {
    const res = await modsFetch('/pickem/meta');
    if (!res.ok) {
      let detail = '';
      try {
        const body = await res.text();
        if (body) detail = ` — ${body.slice(0, 120)}`;
      } catch {
        // ignore
      }
      console.warn(
        `Mods API probe failed (HTTP ${res.status})${detail}; picks will queue locally until it recovers.`
      );
      return false;
    }

    const data: ModsMetaResponse = await res.json();
    const meta = parseMetaResponse(data);
    if (!meta) {
      return false;
    }

    cachedPickemMeta = meta;
    modsAvailableCached = true;
    return true;
  } catch (error) {
    if (error instanceof ModsApiError) {
      console.warn(`Mods API unavailable: ${error.message}`);
    } else if (isModsHttpBlocked(error)) {
      console.warn(
        'Mods API domain blocked by Devvit (playtest). Picks will queue locally until available.'
      );
    } else {
      console.warn('Mods API unreachable:', error);
    }
    return false;
  }
};

/** Call after a mods API write failure so the next request re-probes. */
export const invalidateModsAvailabilityCache = (): void => {
  modsAvailableCached = null;
};

/** Mock scoreboard/picks only in playtest when backends are down (never on live subs). */
export const shouldUsePlaytestMock = async (): Promise<boolean> => {
  if (await isModsApiAvailable()) {
    return false;
  }
  if (isPlaytestSubreddit()) {
    return true;
  }
  if (!(await hasModsApiSecret())) {
    return true;
  }
  return false;
};

/**
 * @deprecated Use isModsApiAvailable / shouldUsePlaytestMock.
 * True when the legacy mock backend path should run (playtest only).
 */
export const shouldUseMockBackend = shouldUsePlaytestMock;
