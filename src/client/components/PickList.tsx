import type { Game, TeamInfo } from '../../shared/types';
import type { DraftPick } from '../../shared/pickLogic';
import {
  getGamesInPickDisplayOrder,
  isGameLocked,
} from '../../shared/pickLogic';
import { hasLiveScores } from '../../shared/scoreboardNormalize';
import { TeamLogo } from './TeamLogo';

type TeamPickButtonProps = {
  team: TeamInfo;
  selected: boolean;
  locked: boolean;
  onSelect: () => void;
};

const TeamPickButton = ({
  team,
  selected,
  locked,
  onSelect,
}: TeamPickButtonProps) => (
  <button
    type="button"
    disabled={locked}
    onClick={onSelect}
    className={`flex w-full items-center gap-1.5 sm:gap-2 min-w-0 rounded-lg border px-2 py-2 sm:py-1.5 transition-colors text-left ${
      selected
        ? 'border-[#d93900] bg-orange-50 dark:bg-orange-950/30 ring-1 ring-[#d93900]'
        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
    } ${locked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
  >
    <TeamLogo
      flairSlug={team.flair_slug}
      name={team.name}
      size="sm"
    />
    <span
      className={`min-w-0 flex-1 font-medium leading-snug text-gray-900 dark:text-gray-100 line-clamp-2 break-words text-[11px] sm:text-sm sm:truncate sm:whitespace-nowrap sm:leading-normal ${
        team.short.length > 14 ? 'text-[10px] sm:text-sm' : ''
      }`}
    >
      {team.short}
    </span>
  </button>
);

type PickListProps = {
  games: Game[];
  draftPicks: DraftPick[];
  isLoggedIn: boolean;
  saving: boolean;
  saved: boolean;
  error: string | null;
  saveNotice: string | null;
  onSetWinner: (gameId: string, pick: string) => void;
  onReorderUnlocked: (fromIndex: number, toIndex: number) => void;
  onAssignPoints: () => void;
  onSave: () => void;
};

export const PickList = ({
  games,
  draftPicks,
  isLoggedIn,
  saving,
  saved,
  error,
  saveNotice,
  onSetWinner,
  onReorderUnlocked,
  onAssignPoints,
  onSave,
}: PickListProps) => {
  const displayOrder = getGamesInPickDisplayOrder(draftPicks, games);
  const unlockedInDisplay = displayOrder.filter((g) => !isGameLocked(g));
  const unlockedCount = unlockedInDisplay.length;
  const unlockedIndexById = new Map(
    unlockedInDisplay.map((g, index) => [g.id, index])
  );

  const allHaveWinners = draftPicks.every((p) => p.pick !== null);

  const moveUnlocked = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= unlockedCount) return;
    onReorderUnlocked(index, target);
  };

  if (!isLoggedIn) {
    return (
      <div className="text-center py-8 px-4">
        <p className="text-gray-600 dark:text-gray-300">
          Log in to Reddit to make your picks.
        </p>
      </div>
    );
  }

  const renderGameRow = (game: Game, unlockedIndex: number | null) => {
    const draft = draftPicks.find((p) => p.game_id === game.id);
    const locked = isGameLocked(game);
    const canReorder = unlockedIndex !== null;
    const atTop = unlockedIndex === 0;
    const atBottom = unlockedIndex === unlockedCount - 1;

    const awaySelected = draft?.pick === game.away.short;
    const homeSelected = draft?.pick === game.home.short;

    return (
      <div
        key={game.id}
        className={`flex items-start gap-2 sm:items-center sm:gap-3 p-3 rounded-lg border ${
          locked
            ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-70'
            : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'
        }`}
      >
        {canReorder ? (
          <div className="flex flex-col flex-shrink-0 gap-0.5 pt-0.5 sm:pt-0">
            <button
              type="button"
              aria-label="Move up — more confidence"
              disabled={atTop}
              onClick={() => moveUnlocked(unlockedIndex, 'up')}
              className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-md border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <span className="text-base sm:text-lg leading-none" aria-hidden>
                ↑
              </span>
            </button>
            <button
              type="button"
              aria-label="Move down — less confidence"
              disabled={atBottom}
              onClick={() => moveUnlocked(unlockedIndex, 'down')}
              className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-md border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <span className="text-base sm:text-lg leading-none" aria-hidden>
                ↓
              </span>
            </button>
          </div>
        ) : (
          <div className="w-8 sm:w-9 flex-shrink-0" />
        )}

        <div
          className={`flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold mt-0.5 sm:mt-0 ${
            draft?.points
              ? 'bg-[#d93900] text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
          }`}
        >
          {draft?.points ?? '–'}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-col gap-1.5 sm:hidden">
            <TeamPickButton
              team={game.away}
              selected={awaySelected}
              locked={locked}
              onSelect={() => onSetWinner(game.id, game.away.short)}
            />
            <TeamPickButton
              team={game.home}
              selected={homeSelected}
              locked={locked}
              onSelect={() => onSetWinner(game.id, game.home.short)}
            />
          </div>

          <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1">
            <TeamPickButton
              team={game.away}
              selected={awaySelected}
              locked={locked}
              onSelect={() => onSetWinner(game.id, game.away.short)}
            />
            <span className="text-gray-400 text-xs text-center">@</span>
            <TeamPickButton
              team={game.home}
              selected={homeSelected}
              locked={locked}
              onSelect={() => onSetWinner(game.id, game.home.short)}
            />
          </div>

          <p className="text-xs text-gray-500 mt-1.5 sm:mt-1">
            {game.kickoff_et}
            {locked &&
              (draft?.points != null
                ? ` · Started — locked at ${draft.points} pt${draft.points === 1 ? '' : 's'}`
                : ' · Started — locked')}
            {hasLiveScores(game) &&
              ` · ${game.away_score}-${game.home_score}`}
            {game.status === 'in_progress' && ' · LIVE'}
            {game.status === 'final' && ' · Final'}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Pick winners, then use ↑ ↓ to rank confidence (top = most points).
          Started games lock at the bottom.
        </p>
        <button
          type="button"
          onClick={onAssignPoints}
          className="text-sm text-[#d93900] hover:underline whitespace-nowrap"
        >
          Auto-assign by kickoff
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {displayOrder.map((game) => {
          const locked = isGameLocked(game);
          const unlockedIndex = locked
            ? null
            : (unlockedIndexById.get(game.id) ?? null);
          return renderGameRow(game, unlockedIndex);
        })}
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {saved && (
        <p className="text-sm text-green-600 dark:text-green-400">
          {saveNotice ?? 'Picks saved successfully!'}
        </p>
      )}

      {saved && saveNotice && (
        <p className="text-xs text-amber-700 dark:text-amber-300 text-center">
          Standings on pickem.redditcfb.com may update once the server syncs.
        </p>
      )}

      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="w-full py-3 rounded-full bg-[#d93900] text-white font-semibold hover:bg-[#c23300] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {saving ? 'Saving…' : 'Save Picks'}
      </button>

      {!allHaveWinners && (
        <p className="text-xs text-gray-500 text-center">
          Started games will auto-receive the lowest remaining points on save.
        </p>
      )}
    </div>
  );
};
