import { useCallback, useEffect, useRef, useState } from 'react';
import type { BootstrapResponse, SavePicksResponse, SlateResponse } from '../../shared/api';
import { SLATE_POLL_MS } from '../../shared/constants';
import type { Game, PostBinding, UserPick } from '../../shared/types';
import type { DraftPick } from '../../shared/pickLogic';
import {
  assignPointsChronological,
  draftToSubmissions,
  finalizePicksForSave,
  isGameLocked,
  reorderUnlockedPicks,
  reshuffleUnselectedPicks,
  sortGamesByKickoff,
  validatePicksForSave,
} from '../../shared/pickLogic';
import { resolvePickForGame } from '../../shared/teamPick';
import {
  getPollIntervalMs,
  needsLivePolling,
} from '../../shared/scoreboardNormalize';

type PickemState = {
  loading: boolean;
  error: string | null;
  postId: string | null;
  username: string | null;
  isLoggedIn: boolean;
  isModerator: boolean;
  inAppSlateConfig: boolean;
  modsAvailable: boolean;
  playtestMode: boolean;
  liveScoreboard: boolean;
  gamesError: string | null;
  gamesCachedAt: string | null;
  scoreboardStale: boolean;
  picksPendingSync: boolean;
  binding: PostBinding | null;
  games: Game[];
  picks: UserPick[];
  draftPicks: DraftPick[];
  seasonTotal: number | null;
  saving: boolean;
  saved: boolean;
  saveNotice: string | null;
  slateUpdatedAt: string | null;
  isRefreshingSlate: boolean;
};

const emptyDraft = (games: Game[]): DraftPick[] =>
  assignPointsChronological(
    sortGamesByKickoff(games).map((g) => ({
      game_id: g.id,
      pick: null,
      points: null,
    })),
    games
  );

const picksToDraft = (games: Game[], picks: UserPick[]): DraftPick[] => {
  const pickMap = new Map(picks.map((p) => [p.game_id, p]));
  const gameMap = new Map(games.map((g) => [g.id, g]));
  const base = sortGamesByKickoff(games).map((g) => {
    const existing = pickMap.get(g.id);
    const rawPick = existing?.pick ?? null;
    const pick =
      rawPick && gameMap.has(g.id)
        ? resolvePickForGame(rawPick, g) ?? rawPick
        : rawPick;
    return {
      game_id: g.id,
      pick,
      points: existing?.points ?? null,
    };
  });

  if (base.some((p) => p.points === null)) {
    return assignPointsChronological(base, games);
  }

  return base;
};

const applyBootstrap = (
  data: BootstrapResponse,
  picks: UserPick[]
): Pick<PickemState, 'draftPicks'> & Omit<PickemState, 'draftPicks' | 'loading'> => {
  const draftPicks =
    picks.length > 0
      ? picksToDraft(data.games, picks)
      : emptyDraft(data.games);

  return {
    error: data.gamesError,
    postId: data.postId,
    username: data.username,
    isLoggedIn: data.isLoggedIn,
    isModerator: data.isModerator,
    inAppSlateConfig: data.inAppSlateConfig,
    modsAvailable: data.modsAvailable,
    playtestMode: data.playtestMode,
    liveScoreboard: data.liveScoreboard,
    gamesError: data.gamesError,
    gamesCachedAt: data.gamesCachedAt,
    scoreboardStale: data.scoreboardStale,
    picksPendingSync: data.picksPendingSync,
    binding: data.binding,
    games: data.games,
    picks,
    draftPicks,
    seasonTotal: data.seasonTotal,
    saving: false,
    saved: false,
    saveNotice: null,
    slateUpdatedAt: data.fetchedAt,
    isRefreshingSlate: false,
  };
};

export const usePickem = () => {
  const [state, setState] = useState<PickemState>({
    loading: true,
    error: null,
    postId: null,
    username: null,
    isLoggedIn: false,
    isModerator: false,
    inAppSlateConfig: false,
    modsAvailable: true,
    playtestMode: false,
    liveScoreboard: false,
    gamesError: null,
    gamesCachedAt: null,
    scoreboardStale: false,
    picksPendingSync: false,
    binding: null,
    games: [],
    picks: [],
    draftPicks: [],
    seasonTotal: null,
    saving: false,
    saved: false,
    saveNotice: null,
    slateUpdatedAt: null,
    isRefreshingSlate: false,
  });

  const gamesRef = useRef<Game[]>([]);
  gamesRef.current = state.games;

  const applySlate = useCallback((slate: SlateResponse) => {
    setState((s) => ({
      ...s,
      isRefreshingSlate: false,
      binding: slate.binding,
      games: slate.games,
      liveScoreboard: slate.liveScoreboard,
      gamesError: slate.gamesError,
      gamesCachedAt: slate.gamesCachedAt,
      scoreboardStale: slate.scoreboardStale,
      slateUpdatedAt: slate.fetchedAt,
      error: slate.gamesError,
    }));
  }, []);

  const fetchSlate = useCallback(async (refresh = false): Promise<SlateResponse | null> => {
    const url = refresh ? '/api/slate?refresh=1' : '/api/slate';
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.json() as Promise<SlateResponse>;
  }, []);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      const res = await fetch('/api/bootstrap');
      if (!res.ok) {
        throw new Error(`Load failed: ${res.status}`);
      }

      const data: BootstrapResponse = await res.json();
      setState({
        loading: false,
        ...applyBootstrap(data, data.picks),
      });
    } catch (err) {
      console.error('Failed to load pickem', err);
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load',
      }));
    }
  }, []);

  const refreshSlate = useCallback(async () => {
    if (!needsLivePolling(gamesRef.current)) return;

    setState((s) => ({ ...s, isRefreshingSlate: true }));
    try {
      const slate = await fetchSlate(true);
      if (!slate) {
        setState((s) => ({ ...s, isRefreshingSlate: false }));
        return;
      }
      applySlate(slate);
    } catch (err) {
      console.error('Slate refresh failed', err);
      setState((s) => ({ ...s, isRefreshingSlate: false }));
    }
  }, [applySlate, fetchSlate]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (state.loading || !state.liveScoreboard) return;
    if (!needsLivePolling(state.games)) return;

    const intervalMs = getPollIntervalMs(state.games) || SLATE_POLL_MS;
    const id = setInterval(() => {
      void refreshSlate();
    }, intervalMs);

    return () => clearInterval(id);
  }, [state.loading, state.liveScoreboard, state.games, refreshSlate]);

  const setWinner = useCallback((gameId: string, pick: string) => {
    setState((s) => {
      const game = s.games.find((g) => g.id === gameId);
      if (game && isGameLocked(game)) return s;

      return {
        ...s,
        saved: false,
        saveNotice: null,
        draftPicks: s.draftPicks.map((p) =>
          p.game_id === gameId ? { ...p, pick } : p
        ),
      };
    });
  }, []);

  const moveGame = useCallback((fromIndex: number, toIndex: number) => {
    setState((s) => {
      let draft = s.draftPicks;
      const unlocked = s.games.filter((g) => !isGameLocked(g));
      const hasPoints = unlocked.some((g) => {
        const pick = draft.find((p) => p.game_id === g.id);
        return pick?.points != null;
      });

      if (!hasPoints && unlocked.length > 0) {
        draft = assignPointsChronological(draft, s.games);
      }

      return {
        ...s,
        saved: false,
        saveNotice: null,
        draftPicks: reorderUnlockedPicks(draft, s.games, fromIndex, toIndex),
      };
    });
  }, []);

  const assignPoints = useCallback(() => {
    setState((s) => ({
      ...s,
      saved: false,
      saveNotice: null,
      draftPicks: assignPointsChronological(s.draftPicks, s.games),
    }));
  }, []);

  const savePicks = useCallback(async () => {
    setState((s) => ({ ...s, saving: true, error: null, saveNotice: null }));

    try {
      const current = await new Promise<PickemState>((resolve) => {
        setState((s) => {
          resolve(s);
          return { ...s, saving: true, error: null, saveNotice: null };
        });
      });

      if (current.games.length === 0) {
        setState((s) => ({
          ...s,
          saving: false,
          error: current.gamesError ?? 'No games loaded to save picks for.',
        }));
        return;
      }

      let draft = current.draftPicks;
      if (draft.some((p) => p.pick === null || p.points === null)) {
        draft = reshuffleUnselectedPicks(draft, current.games);
      }

      const submissions = finalizePicksForSave(
        draftToSubmissions(draft),
        current.games
      );
      const validationError = validatePicksForSave(submissions, current.games);
      if (validationError) {
        setState((s) => ({
          ...s,
          saving: false,
          error: validationError,
        }));
        return;
      }

      const res = await fetch('/api/picks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ picks: submissions }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? `Save failed: ${res.status}`);
      }

      const data: SavePicksResponse = await res.json();
      setState((s) => ({
        ...s,
        saving: false,
        saved: true,
        picks: data.picks,
        draftPicks: picksToDraft(s.games, data.picks),
        seasonTotal: data.seasonTotal,
        picksPendingSync: data.pendingSync,
        saveNotice: data.pendingSync
          ? 'Picks saved locally — they will sync to pickem when the server reconnects.'
          : null,
        error: null,
      }));
    } catch (err) {
      console.error('Save failed', err);
      setState((s) => ({
        ...s,
        saving: false,
        error: err instanceof Error ? err.message : 'Failed to save picks',
      }));
    }
  }, []);

  return {
    ...state,
    reload: load,
    refreshSlate,
    setWinner,
    moveGame,
    assignPoints,
    savePicks,
  };
};
