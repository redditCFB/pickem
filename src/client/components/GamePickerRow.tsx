import type { Game } from '../../shared/types';
import { TeamLogo } from './TeamLogo';

type GamePickerRowProps = {
  game: Game;
  isSelected: boolean;
  disabled: boolean;
  onToggle: (id: string) => void;
};

export const GamePickerRow = ({
  game,
  isSelected,
  disabled,
  onToggle,
}: GamePickerRowProps) => (
  <button
    type="button"
    disabled={disabled || game.is_locked_for_picks}
    onClick={() => onToggle(game.id)}
    className={`flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${
      isSelected
        ? 'bg-[#d93900]/10 border border-[#d93900]/30'
        : 'hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent'
    } ${disabled || game.is_locked_for_picks ? 'opacity-40 cursor-not-allowed' : ''}`}
  >
    <input
      type="checkbox"
      checked={isSelected}
      readOnly
      className="accent-[#d93900]"
    />
    <TeamLogo flairSlug={game.away.flair_slug} name={game.away.name} size="sm" />
    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
      {game.away.short}
    </span>
    <span className="text-gray-400 dark:text-gray-500 text-xs">@</span>
    <TeamLogo flairSlug={game.home.flair_slug} name={game.home.name} size="sm" />
    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
      {game.home.short}
    </span>
    <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto shrink-0">
      {game.kickoff_et} ET
      {game.is_locked_for_picks ? ' · started' : ''}
    </span>
  </button>
);
