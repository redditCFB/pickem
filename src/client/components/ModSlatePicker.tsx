import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GamePoolResponse, ModSlateResponse, PublishPostResponse } from '../../shared/api';
import {
  DEFAULT_SLATE_SIZE,
  FALLBACK_PICKEM_META,
  MAX_SLATE_SIZE,
  MIN_SLATE_SIZE,
} from '../../shared/constants';
import { groupGamesForPicker } from '../../shared/groupGamesForPicker';
import type { Game } from '../../shared/types';
import { GamePickerRow } from './GamePickerRow';

type ModSlatePickerProps = {
  compact?: boolean;
  initialSeason?: string | undefined;
  initialWeek?: number | undefined;
  onSlateSaved?: () => void;
};

type PickerState = {
  loading: boolean;
  saving: boolean;
  publishing: boolean;
  error: string | null;
  success: string | null;
  season: string;
  week: number;
  games: Game[];
  selected: Set<string>;
  search: string;
  publishedUrl: string | null;
  expandedDivisions: Set<string>;
  expandedConferences: Set<string>;
};

const defaultExpandedDivisions = () => new Set(['fbs']);

export const ModSlatePicker = ({
  compact = false,
  initialSeason,
  initialWeek,
  onSlateSaved,
}: ModSlatePickerProps) => {
  const [state, setState] = useState<PickerState>({
    loading: true,
    saving: false,
    publishing: false,
    error: null,
    success: null,
    season: FALLBACK_PICKEM_META.current_season,
    week: FALLBACK_PICKEM_META.current_week,
    games: [],
    selected: new Set(),
    search: '',
    publishedUrl: null,
    expandedDivisions: defaultExpandedDivisions(),
    expandedConferences: new Set(),
  });

  const loadPool = useCallback(async (season?: string, week?: number) => {
    setState((s) => ({
      ...s,
      loading: true,
      error: null,
      success: null,
    }));
    try {
      const resolvedSeason = season ?? initialSeason;
      const resolvedWeek = week ?? initialWeek;
      const query =
        resolvedSeason !== undefined && resolvedWeek !== undefined
          ? `?season=${encodeURIComponent(resolvedSeason)}&week=${resolvedWeek}`
          : '';
      const res = await fetch(`/api/mod/pool${query}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? 'Failed to load games');
      }
      const data: GamePoolResponse = await res.json();

      let selected = new Set<string>();
      const slateRes = await fetch(
        `/api/mod/slate?season=${encodeURIComponent(data.meta.current_season)}&week=${data.meta.current_week}`
      );
      if (slateRes.ok) {
        const slate: ModSlateResponse = await slateRes.json();
        selected = new Set(slate.game_ids.map(String));
      }

      setState((s) => ({
        ...s,
        loading: false,
        season: data.meta.current_season,
        week: data.meta.current_week,
        games: data.games,
        selected,
        expandedDivisions: defaultExpandedDivisions(),
        expandedConferences: new Set(),
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load games',
      }));
    }
  }, [initialSeason, initialWeek]);

  useEffect(() => {
    void loadPool();
  }, [loadPool]);

  const toggleGame = (id: string) => {
    setState((s) => {
      const next = new Set(s.selected);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_SLATE_SIZE) {
        next.add(id);
      }
      return { ...s, selected: next, success: null };
    });
  };

  const removeGame = (id: string) => {
    setState((s) => {
      const next = new Set(s.selected);
      next.delete(id);
      return { ...s, selected: next, success: null };
    });
  };

  const toggleDivision = (division: string) => {
    setState((s) => {
      const next = new Set(s.expandedDivisions);
      if (next.has(division)) {
        next.delete(division);
      } else {
        next.add(division);
      }
      return { ...s, expandedDivisions: next };
    });
  };

  const toggleConference = (key: string) => {
    setState((s) => {
      const next = new Set(s.expandedConferences);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return { ...s, expandedConferences: next };
    });
  };

  const selectedGames = useMemo(
    () => state.games.filter((g) => state.selected.has(g.id)),
    [state.games, state.selected]
  );

  const filtered = useMemo(() => {
    const q = state.search.trim().toLowerCase();
    if (!q) return state.games;
    return state.games.filter(
      (g) =>
        g.away.name.toLowerCase().includes(q) ||
        g.home.name.toLowerCase().includes(q) ||
        g.away.short.toLowerCase().includes(q) ||
        g.home.short.toLowerCase().includes(q) ||
        (g.away.conference?.toLowerCase().includes(q) ?? false) ||
        (g.home.conference?.toLowerCase().includes(q) ?? false)
    );
  }, [state.games, state.search]);

  const grouped = useMemo(
    () => groupGamesForPicker(filtered),
    [filtered]
  );

  const isSearching = state.search.trim().length > 0;

  const canSaveSlate =
    state.selected.size >= MIN_SLATE_SIZE &&
    state.selected.size <= MAX_SLATE_SIZE;

  const saveSlate = async () => {
    if (!canSaveSlate) return;

    setState((s) => ({ ...s, saving: true, error: null, success: null }));
    try {
      const res = await fetch('/api/mod/slate', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season: state.season,
          week: state.week,
          game_ids: Array.from(state.selected),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? 'Failed to save slate');
      }

      setState((s) => ({
        ...s,
        saving: false,
        success: `Week ${s.week} slate saved.`,
      }));
      onSlateSaved?.();
    } catch (err) {
      setState((s) => ({
        ...s,
        saving: false,
        error: err instanceof Error ? err.message : 'Failed to save slate',
      }));
    }
  };

  const publish = async () => {
    if (!canSaveSlate) return;

    setState((s) => ({
      ...s,
      publishing: true,
      error: null,
      success: null,
    }));
    try {
      const res = await fetch('/api/mod/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season: state.season,
          week: state.week,
          game_ids: Array.from(state.selected),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? 'Publish failed');
      }

      const data: PublishPostResponse = await res.json();
      setState((s) => ({
        ...s,
        publishing: false,
        publishedUrl: data.postUrl,
        success: `Week ${s.week} post published!`,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        publishing: false,
        error: err instanceof Error ? err.message : 'Publish failed',
      }));
    }
  };

  const renderGameRow = (game: Game) => {
    const isSelected = state.selected.has(game.id);
    const disabled = !isSelected && state.selected.size >= MAX_SLATE_SIZE;

    return (
      <GamePickerRow
        key={game.id}
        game={game}
        isSelected={isSelected}
        disabled={disabled}
        onToggle={toggleGame}
      />
    );
  };

  return (
    <div
      className={
        compact ? 'flex flex-col gap-4' : 'min-h-screen bg-white dark:bg-gray-900'
      }
    >
      {!compact && (
        <header className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Configure Pick &apos;Em Slate
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Browse FBS and FCS games by conference, or search. Select games
            for this week ({DEFAULT_SLATE_SIZE} is standard), then save and
            publish.
          </p>
        </header>
      )}

      {compact && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          Select games for this week from the scoreboard ({DEFAULT_SLATE_SIZE}{' '}
          is standard), then save to update the slate for this post.
        </p>
      )}

      <div className={`flex flex-wrap gap-3 items-end ${compact ? '' : 'p-4'}`}>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-600 dark:text-gray-400">Season</span>
          <input
            type="text"
            value={state.season}
            onChange={(e) =>
              setState((s) => ({ ...s, season: e.target.value.trim() }))
            }
            className="border rounded px-2 py-1 w-32 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-600 dark:text-gray-400">Week</span>
          <input
            type="number"
            value={state.week}
            onChange={(e) =>
              setState((s) => ({ ...s, week: Number(e.target.value) }))
            }
            className="border rounded px-2 py-1 w-20 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
          />
        </label>
        <button
          type="button"
          onClick={() => void loadPool(state.season, state.week)}
          className="px-4 py-1.5 rounded bg-gray-200 dark:bg-gray-700 text-sm font-medium text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600"
        >
          Load games
        </button>
        <div className="flex-1 min-w-[200px]">
          <input
            type="search"
            placeholder="Search teams or conferences…"
            value={state.search}
            onChange={(e) =>
              setState((s) => ({ ...s, search: e.target.value }))
            }
            className="w-full border rounded px-3 py-1.5 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
          />
        </div>
      </div>

      <div className={compact ? '' : 'px-4'}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-[#d93900]">
            {state.selected.size} selected
            {state.selected.size > 0 &&
              state.selected.size !== DEFAULT_SLATE_SIZE &&
              ` (standard is ${DEFAULT_SLATE_SIZE})`}
          </span>
          {state.loading && (
            <span className="text-xs text-gray-600 dark:text-gray-400">
              Loading…
            </span>
          )}
          {!state.loading && (
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {state.games.length} games (FBS + FCS)
            </span>
          )}
        </div>

        {selectedGames.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {selectedGames.map((game) => (
              <button
                key={game.id}
                type="button"
                onClick={() => removeGame(game.id)}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#d93900]/10 border border-[#d93900]/20 text-xs font-medium text-gray-900 dark:text-gray-100"
                title="Remove from slate"
              >
                {game.away.short} @ {game.home.short}
                <span className="text-gray-500 dark:text-gray-400">×</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {state.error && (
        <p className={`text-sm text-red-600 dark:text-red-400 ${compact ? '' : 'px-4'}`}>
          {state.error}
        </p>
      )}

      {state.success && (
        <p
          className={`text-sm text-green-600 dark:text-green-400 ${compact ? '' : 'px-4'}`}
        >
          {state.success}
          {state.publishedUrl && (
            <>
              {' '}
              <a
                href={state.publishedUrl}
                className="underline font-medium text-[#d93900] dark:text-orange-400"
              >
                View post
              </a>
            </>
          )}
        </p>
      )}

      <div
        className={`flex flex-col gap-1 overflow-y-auto ${
          compact ? 'max-h-[50vh]' : 'px-2 pb-32 max-h-[55vh]'
        }`}
      >
        {isSearching ? (
          filtered.map((game) => renderGameRow(game))
        ) : (
          grouped.map((divisionGroup) => {
            const divisionOpen = state.expandedDivisions.has(
              divisionGroup.division
            );

            return (
              <div
                key={divisionGroup.division}
                className="border border-gray-200 dark:border-gray-700 rounded-lg mb-2 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleDivision(divisionGroup.division)}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-100 dark:bg-gray-800 text-left"
                >
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {divisionGroup.label}
                  </span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {divisionGroup.gameCount} games {divisionOpen ? '▾' : '▸'}
                  </span>
                </button>

                {divisionOpen &&
                  divisionGroup.conferences.map((conferenceGroup) => {
                    const conferenceKey = `${divisionGroup.division}:${conferenceGroup.name}`;
                    const conferenceOpen =
                      state.expandedConferences.has(conferenceKey);

                    return (
                      <div
                        key={conferenceKey}
                        className="border-t border-gray-200 dark:border-gray-700"
                      >
                        <button
                          type="button"
                          onClick={() => toggleConference(conferenceKey)}
                          className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-900/60 text-left"
                        >
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                            {conferenceGroup.name}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {conferenceGroup.games.length}{' '}
                            {conferenceOpen ? '▾' : '▸'}
                          </span>
                        </button>

                        {conferenceOpen && (
                          <div className="px-2 py-1 flex flex-col gap-1">
                            {conferenceGroup.games.map((game) =>
                              renderGameRow(game)
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            );
          })
        )}

        {!state.loading && filtered.length === 0 && (
          <p className="text-sm text-gray-600 dark:text-gray-400 p-4 text-center">
            No games match your search.
          </p>
        )}
      </div>

      <div
        className={
          compact
            ? 'pt-2'
            : 'fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-2'
        }
      >
        <button
          type="button"
          onClick={() => void saveSlate()}
          disabled={state.saving || !canSaveSlate}
          className={
            compact
              ? 'w-full py-3 rounded-full bg-[#d93900] text-white font-semibold hover:bg-[#c23300] disabled:opacity-50 disabled:cursor-not-allowed'
              : 'flex-1 py-3 rounded-full border border-[#d93900] text-[#d93900] dark:text-orange-400 font-semibold hover:bg-[#d93900]/5 disabled:opacity-50 disabled:cursor-not-allowed'
          }
        >
          {state.saving ? 'Saving…' : 'Save slate'}
        </button>
        {!compact && (
          <button
            type="button"
            onClick={() => void publish()}
            disabled={state.publishing || !canSaveSlate}
            className="flex-1 py-3 rounded-full bg-[#d93900] text-white font-semibold hover:bg-[#c23300] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {state.publishing
              ? 'Publishing…'
              : `Publish Week ${state.week} post`}
          </button>
        )}
      </div>
    </div>
  );
};
