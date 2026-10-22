import { needsLivePolling } from '../../shared/scoreboardNormalize';
import type { Game, PostBinding } from '../../shared/types';
import { redis } from '@devvit/web/server';

const CACHE_TTL_LIVE_MS = 30_000;
const CACHE_TTL_IDLE_MS = 300_000;
/** Serve last-known slate during scoreboard outages (production degrade). */
export const STALE_SLATE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const cacheKey = (binding: PostBinding): string =>
  `pickem:slate:games:${binding.season}:${binding.week}:${binding.group_id}:${binding.slate_game_ids.join(',')}`;

type CachedSlate = {
  games: Game[];
  cachedAt: number;
};

const freshMaxAgeMs = (games: Game[]): number =>
  needsLivePolling(games) ? CACHE_TTL_LIVE_MS : CACHE_TTL_IDLE_MS;

export type CachedSlateResult = {
  games: Game[];
  cachedAt: string;
  stale: boolean;
};

export const getCachedSlateGames = async (
  binding: PostBinding,
  options?: { allowStale?: boolean }
): Promise<CachedSlateResult | null> => {
  const raw = await redis.get(cacheKey(binding));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as CachedSlate;
    if (!Array.isArray(parsed.games) || typeof parsed.cachedAt !== 'number') {
      return null;
    }

    const ageMs = Date.now() - parsed.cachedAt;
    const freshLimit = freshMaxAgeMs(parsed.games);
    const cachedAt = new Date(parsed.cachedAt).toISOString();

    if (ageMs <= freshLimit) {
      return { games: parsed.games, cachedAt, stale: false };
    }

    if (options?.allowStale && ageMs <= STALE_SLATE_MAX_AGE_MS) {
      return { games: parsed.games, cachedAt, stale: true };
    }

    return null;
  } catch {
    return null;
  }
};

export const setCachedSlateGames = async (
  binding: PostBinding,
  games: Game[]
): Promise<void> => {
  const payload: CachedSlate = { games, cachedAt: Date.now() };
  await redis.set(cacheKey(binding), JSON.stringify(payload));
};

export const invalidateSlateCache = async (
  binding: PostBinding
): Promise<void> => {
  await redis.del(cacheKey(binding));
};
