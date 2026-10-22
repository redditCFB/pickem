import { FALLBACK_PICKEM_META, MIN_SLATE_SIZE } from '../../shared/constants';
import type {
  Game,
  PickemMeta,
  PickSubmission,
  PostBinding,
  UserPick,
} from '../../shared/types';
import {
  finalizePicksForSave,
  validatePicksForSave,
} from '../../shared/pickLogic';
import { scoreboardSeasonYear } from '../../shared/season';
import * as scoreboard from './scoreboard';
import * as modsApi from './modsApi';
import { getPickemGroupId } from './groupConfig';
import {
  mockGamePool,
  mockMeta,
  mockSeasonTotal,
  mockSlateGames,
} from './mockData';
import { getPostBinding, setLastPublishedPostId, setPostBinding } from './postBinding';
import {
  clearDraftUserPicks,
  getDraftUserPicks,
  setDraftUserPicks,
} from './draftPicksStore';
import {
  getCachedSlateGames,
  invalidateSlateCache,
  setCachedSlateGames,
} from './slateCache';
import { getInAppSlateConfig } from './subredditConfig';
import { isCurrentUserModerator } from './moderator';
import { createPickemPost } from '../core/post';
import { isPlaytestSubreddit } from './playtest';

export type SlateGamesResult = {
  games: Game[];
  liveScoreboard: boolean;
  gamesError: string | null;
  gamesCachedAt: string | null;
  scoreboardStale: boolean;
};

export type GetSlateGamesOptions = {
  bypassCache?: boolean;
};

export type PicksLoadResult = {
  picks: UserPick[];
  seasonTotal: number | null;
  pendingSync: boolean;
};

export type PicksSaveResult = PicksLoadResult;

const GAMES_UNAVAILABLE_MSG =
  "Unable to load this week's games. The scoreboard may be temporarily unavailable — please try again.";

const mockSlateFromBinding = (binding: PostBinding): Game[] => {
  if (binding.slate_game_ids.length > 0) {
    const idSet = new Set(binding.slate_game_ids);
    const fromPool = mockGamePool.filter((g) => idSet.has(g.id));
    if (fromPool.length > 0) {
      return fromPool;
    }
  }
  return mockSlateGames;
};

const toUserPicks = (finalized: PickSubmission[]): UserPick[] =>
  finalized.map((p) => ({
    ...p,
    is_correct: null,
    points_earned: null,
  }));

const syncPendingPicksIfPossible = async (
  binding: PostBinding,
  username: string,
  games: Game[]
): Promise<PicksLoadResult | null> => {
  const draft = await getDraftUserPicks(binding, username);
  if (!draft?.pendingSync || draft.picks.length === 0) {
    return null;
  }

  if (!(await modsApi.isModsApiAvailable())) {
    return null;
  }

  const submissions: PickSubmission[] = draft.picks.map((p) => ({
    game_id: p.game_id,
    pick: p.pick ?? '',
    points: p.points ?? 0,
  }));

  const finalized = finalizePicksForSave(submissions, games);
  const error = validatePicksForSave(finalized, games);
  if (error) {
    console.warn(`Pending pick sync validation failed for ${username}: ${error}`);
    return null;
  }

  try {
    const result = await modsApi.savePicks(
      binding.season,
      binding.week,
      username,
      finalized,
      binding.group_id
    );
    await clearDraftUserPicks(binding, username);
    return {
      picks: result.picks,
      seasonTotal: result.seasonTotal,
      pendingSync: false,
    };
  } catch (error) {
    modsApi.invalidateModsAvailabilityCache();
    console.warn(`Pending pick sync failed for ${username}:`, error);
    return null;
  }
};

export const getMeta = async (fallback?: PostBinding): Promise<PickemMeta> => {
  if (await modsApi.isModsApiAvailable()) {
    try {
      return await modsApi.fetchMeta();
    } catch (error) {
      console.warn('getMeta fetch failed:', error);
    }
  }

  if (fallback) {
    return { current_season: fallback.season, current_week: fallback.week };
  }

  return FALLBACK_PICKEM_META;
};

export const createBindingFromDb = async (
  season: string,
  week: number,
  groupId?: number
): Promise<PostBinding> => {
  const resolvedGroupId = groupId ?? (await getPickemGroupId());

  if (!(await modsApi.isModsApiAvailable())) {
    throw new Error(
      'Pick\'em server unavailable. Try again in a few minutes.'
    );
  }

  const gameIds = await modsApi.fetchSlate(season, week, resolvedGroupId);
  if (gameIds.length < MIN_SLATE_SIZE) {
    throw new Error(
      `Group ${resolvedGroupId} week ${week} has no games in the database. Configure the slate before publishing.`
    );
  }

  return {
    season,
    week,
    group_id: resolvedGroupId,
    slate_game_ids: gameIds,
  };
};

export const createBindingForPublish = async (
  season: string,
  week: number
): Promise<PostBinding> => {
  const groupId = await getPickemGroupId();
  const inApp = await getInAppSlateConfig();

  if (!inApp) {
    return createBindingFromDb(season, week, groupId);
  }

  if (await modsApi.shouldUsePlaytestMock()) {
    return {
      season,
      week,
      group_id: groupId,
      slate_game_ids: mockSlateGames.map((g) => g.id),
    };
  }

  if (await modsApi.isModsApiAvailable()) {
    try {
      const gameIds = await modsApi.fetchSlate(season, week, groupId);
      if (gameIds.length >= MIN_SLATE_SIZE) {
        return {
          season,
          week,
          group_id: groupId,
          slate_game_ids: gameIds,
        };
      }
    } catch (error) {
      console.warn('No existing slate for publish; Setup tab will configure:', error);
    }
  }

  return {
    season,
    week,
    group_id: groupId,
    slate_game_ids: [],
  };
};

export const getSlateGames = async (
  binding: PostBinding,
  options?: GetSlateGamesOptions
): Promise<SlateGamesResult> => {
  const empty: SlateGamesResult = {
    games: [],
    liveScoreboard: false,
    gamesError: null,
    gamesCachedAt: null,
    scoreboardStale: false,
  };

  if (binding.slate_game_ids.length === 0) {
    return empty;
  }

  if (!options?.bypassCache) {
    const cached = await getCachedSlateGames(binding);
    if (cached) {
      return {
        games: cached.games,
        liveScoreboard: !cached.stale,
        gamesError: null,
        gamesCachedAt: cached.cachedAt,
        scoreboardStale: cached.stale,
      };
    }
  }

  try {
    const games = await scoreboard.fetchSlateGames(
      binding.slate_game_ids,
      binding.season,
      binding.week
    );
    await setCachedSlateGames(binding, games);
    return {
      games,
      liveScoreboard: true,
      gamesError: null,
      gamesCachedAt: new Date().toISOString(),
      scoreboardStale: false,
    };
  } catch (error) {
    console.warn('Scoreboard slate fetch failed:', error);
  }

  const stale = await getCachedSlateGames(binding, { allowStale: true });
  if (stale) {
    return {
      games: stale.games,
      liveScoreboard: false,
      gamesError: null,
      gamesCachedAt: stale.cachedAt,
      scoreboardStale: true,
    };
  }

  if (await modsApi.shouldUsePlaytestMock()) {
    return {
      games: mockSlateFromBinding(binding),
      liveScoreboard: false,
      gamesError: null,
      gamesCachedAt: null,
      scoreboardStale: false,
    };
  }

  return {
    ...empty,
    gamesError: GAMES_UNAVAILABLE_MSG,
  };
};

export const getGamePool = async (
  season: string,
  week: number
): Promise<Game[]> => {
  try {
    return await scoreboard.fetchGames(season, week);
  } catch (error) {
    if (await modsApi.shouldUsePlaytestMock()) {
      return mockGamePool;
    }
    throw error;
  }
};

export const getUserPicks = async (
  binding: PostBinding,
  username: string,
  games: Game[]
): Promise<PicksLoadResult> => {
  const synced = await syncPendingPicksIfPossible(binding, username, games);
  if (synced) {
    return synced;
  }

  if (await modsApi.isModsApiAvailable()) {
    try {
      const result = await modsApi.fetchUserPicks(
        binding.season,
        binding.week,
        username,
        binding.group_id
      );
      return { ...result, pendingSync: false };
    } catch (error) {
      modsApi.invalidateModsAvailabilityCache();
      console.warn('fetchUserPicks failed; using local draft if any:', error);
    }
  }

  const draft = await getDraftUserPicks(binding, username);
  if (draft) {
    return {
      picks: draft.picks,
      seasonTotal: null,
      pendingSync: draft.pendingSync,
    };
  }

  if (await modsApi.shouldUsePlaytestMock()) {
    return { picks: [], seasonTotal: null, pendingSync: false };
  }

  return { picks: [], seasonTotal: null, pendingSync: false };
};

export const saveUserPicks = async (
  binding: PostBinding,
  username: string,
  picks: PickSubmission[],
  games: Game[]
): Promise<PicksSaveResult> => {
  const finalized = finalizePicksForSave(picks, games);
  const error = validatePicksForSave(finalized, games);
  if (error) {
    throw new Error(error);
  }

  if (await modsApi.isModsApiAvailable()) {
    try {
      const result = await modsApi.savePicks(
        binding.season,
        binding.week,
        username,
        finalized,
        binding.group_id
      );
      await clearDraftUserPicks(binding, username);
      return { ...result, pendingSync: false };
    } catch (error) {
      modsApi.invalidateModsAvailabilityCache();
      console.warn('saveUserPicks to mods API failed; queueing locally:', error);
    }
  }

  const saved = toUserPicks(finalized);
  await setDraftUserPicks(binding, username, saved, true);

  if (await modsApi.shouldUsePlaytestMock()) {
    return { picks: saved, seasonTotal: mockSeasonTotal, pendingSync: true };
  }

  return { picks: saved, seasonTotal: null, pendingSync: true };
};

export const resolveBinding = async (
  postId: string
): Promise<PostBinding | null> => {
  const stored = await getPostBinding(postId);
  if (stored) {
    return stored;
  }

  if (isPlaytestSubreddit() && (await modsApi.shouldUsePlaytestMock())) {
    const groupId = await getPickemGroupId();
    const defaultBinding: PostBinding = {
      season: mockMeta.current_season,
      week: mockMeta.current_week,
      group_id: groupId,
      slate_game_ids: mockSlateGames.map((g) => g.id),
    };
    await setPostBinding(postId, defaultBinding);
    return defaultBinding;
  }

  return null;
};

export const validateSlateGames = async (
  season: string,
  week: number,
  gameIds: string[],
  options?: { allowLocked?: boolean }
): Promise<Game[]> => {
  const pool = await getGamePool(season, week);
  const poolMap = new Map(pool.map((g) => [g.id, g]));
  const scoreboardYear = scoreboardSeasonYear(season);

  const games: Game[] = [];
  for (const id of gameIds) {
    const game = poolMap.get(id);
    if (!game) {
      throw new Error(`Game ${id} not found in week ${week}`);
    }
    if (game.season !== scoreboardYear || game.week !== week) {
      throw new Error(`Game ${id} is not in season ${season} week ${week}`);
    }
    games.push(game);
  }

  if (!options?.allowLocked) {
    const started = games.filter((g) => g.is_locked_for_picks);
    if (started.length > 0) {
      throw new Error(
        `${started.length} selected game(s) have already started`
      );
    }
  }

  return games;
};

export const fetchModSlate = async (
  season: string,
  week: number
): Promise<string[]> => {
  if (!(await modsApi.isModsApiAvailable())) {
    throw new Error('Pick\'em server unavailable. Try again in a few minutes.');
  }

  const groupId = await getPickemGroupId();
  return modsApi.fetchSlate(season, week, groupId);
};

export const saveModSlate = async (
  season: string,
  week: number,
  gameIds: string[]
): Promise<PostBinding> => {
  if (!(await modsApi.isModsApiAvailable())) {
    throw new Error('Pick\'em server unavailable. Try again in a few minutes.');
  }

  await validateSlateGames(season, week, gameIds);
  const groupId = await getPickemGroupId();
  await modsApi.saveSlate(season, week, gameIds, groupId);

  const binding: PostBinding = {
    season,
    week,
    group_id: groupId,
    slate_game_ids: gameIds.map(String),
  };
  await invalidateSlateCache(binding);
  return binding;
};

export const publishPickemPost = async (
  season: string,
  week: number
): Promise<{ postId: string }> => {
  const binding = await createBindingForPublish(season, week);
  const post = await createPickemPost(binding);
  await setPostBinding(post.id, binding);
  await setLastPublishedPostId(post.id);
  return { postId: post.id };
};

export type BootstrapData = {
  postId: string;
  username: string | null;
  isLoggedIn: boolean;
  isModerator: boolean;
  inAppSlateConfig: boolean;
  binding: PostBinding;
  meta: PickemMeta;
  modsAvailable: boolean;
  playtestMode: boolean;
  liveScoreboard: boolean;
  games: Game[];
  gamesError: string | null;
  gamesCachedAt: string | null;
  scoreboardStale: boolean;
  picks: UserPick[];
  seasonTotal: number | null;
  picksPendingSync: boolean;
  fetchedAt: string;
};

export const loadBootstrap = async (
  postId: string,
  username: string | null
): Promise<BootstrapData | null> => {
  const [inAppSlateConfig, binding] = await Promise.all([
    getInAppSlateConfig(),
    resolveBinding(postId),
  ]);
  if (!binding) {
    return null;
  }

  const modsAvailable = await modsApi.isModsApiAvailable();
  const playtestMode = await modsApi.shouldUsePlaytestMock();
  const isModerator =
    inAppSlateConfig && (await isCurrentUserModerator());

  const meta = await getMeta(binding);
  const slate = await getSlateGames(binding);
  const picksResult = username
    ? await getUserPicks(binding, username, slate.games)
    : { picks: [], seasonTotal: null, pendingSync: false };

  return {
    postId,
    username,
    isLoggedIn: Boolean(username),
    isModerator,
    inAppSlateConfig,
    binding,
    meta,
    modsAvailable,
    playtestMode,
    liveScoreboard: slate.liveScoreboard,
    games: slate.games,
    gamesError: slate.gamesError,
    gamesCachedAt: slate.gamesCachedAt,
    scoreboardStale: slate.scoreboardStale,
    picks: picksResult.picks,
    seasonTotal: picksResult.seasonTotal,
    picksPendingSync: picksResult.pendingSync,
    fetchedAt: new Date().toISOString(),
  };
};

export type SplashData = {
  binding: PostBinding;
  gameCount: number;
  modsAvailable: boolean;
  playtestMode: boolean;
};

export const loadSplash = async (postId: string): Promise<SplashData | null> => {
  const binding = await resolveBinding(postId);
  if (!binding) {
    return null;
  }

  return {
    binding,
    gameCount: binding.slate_game_ids.length,
    modsAvailable: await modsApi.isModsApiAvailable(),
    playtestMode: await modsApi.shouldUsePlaytestMock(),
  };
};
