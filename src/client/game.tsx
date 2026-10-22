import './index.css';

import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { usePickem } from './hooks/usePickem';
import { PickList } from './components/PickList';
import { ModSlatePicker } from './components/ModSlatePicker';

type GameTab = 'picks' | 'setup';

const formatTime = (iso: string | null): string | null => {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const App = () => {
  const [tab, setTab] = useState<GameTab>('picks');
  const pickem = usePickem();
  const showModSetup = pickem.isModerator && pickem.inAppSlateConfig;

  if (pickem.loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-gray-900">
        <p className="text-gray-600 dark:text-gray-400">Loading Pick &apos;Em…</p>
      </div>
    );
  }

  if (pickem.error && !pickem.binding && pickem.games.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-2 bg-white dark:bg-gray-900 p-4">
        <p className="text-red-600">{pickem.error}</p>
        <button
          type="button"
          onClick={() => void pickem.reload()}
          className="text-sm text-[#d93900] hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  const cachedLabel = formatTime(pickem.gamesCachedAt);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col">
      <header className="px-4 pt-4 pb-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {pickem.binding
                ? `Week ${pickem.binding.week} Pick 'Em`
                : 'Pick \'Em'}
            </h1>
            {pickem.seasonTotal !== null && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Season total:{' '}
                <span className="font-semibold text-[#d93900] dark:text-orange-400">
                  {pickem.seasonTotal} pts
                </span>
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {pickem.liveScoreboard && !pickem.scoreboardStale && (
              <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                Live scores
              </span>
            )}
            {pickem.playtestMode && (
              <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                Preview mode
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5 mt-2">
          {!pickem.modsAvailable && !pickem.playtestMode && (
            <p className="text-xs text-amber-900 dark:text-amber-100 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded px-2 py-1.5">
              Pick&apos;em server temporarily unavailable. You can still pick
              winners here — saves sync when the server reconnects.
            </p>
          )}
          {pickem.picksPendingSync && (
            <p className="text-xs text-amber-900 dark:text-amber-100 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded px-2 py-1.5">
              Your picks are saved locally and waiting to sync.
            </p>
          )}
          {pickem.scoreboardStale && cachedLabel && (
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Scores as of {cachedLabel}
              {pickem.isRefreshingSlate ? ' · refreshing…' : ''}
            </p>
          )}
          {pickem.liveScoreboard && pickem.slateUpdatedAt && tab === 'picks' && !pickem.scoreboardStale && (
            <p className="text-xs text-gray-400">
              Scores updated{' '}
              {new Date(pickem.slateUpdatedAt).toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit',
              })}
              {pickem.isRefreshingSlate ? ' · refreshing…' : ''}
            </p>
          )}
        </div>
      </header>

      {showModSetup && (
        <nav className="flex border-b border-gray-200 dark:border-gray-700 px-4">
          <button
            type="button"
            onClick={() => setTab('picks')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${
              tab === 'picks'
                ? 'border-[#d93900] text-[#d93900] dark:text-orange-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            Picks
          </button>
          <button
            type="button"
            onClick={() => setTab('setup')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${
              tab === 'setup'
                ? 'border-[#d93900] text-[#d93900] dark:text-orange-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            Setup
          </button>
        </nav>
      )}

      <main className="flex-1 overflow-y-auto">
        {tab === 'picks' && pickem.gamesError && pickem.games.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {pickem.gamesError}
            </p>
            <button
              type="button"
              onClick={() => void pickem.reload()}
              className="text-sm text-[#d93900] hover:underline"
            >
              Retry
            </button>
          </div>
        ) : (
          tab === 'picks' && (
            <PickList
              games={pickem.games}
              draftPicks={pickem.draftPicks}
              isLoggedIn={pickem.isLoggedIn}
              saving={pickem.saving}
              saved={pickem.saved}
              error={pickem.error}
              saveNotice={pickem.saveNotice}
              onSetWinner={pickem.setWinner}
              onReorderUnlocked={pickem.moveGame}
              onAssignPoints={pickem.assignPoints}
              onSave={() => void pickem.savePicks()}
            />
          )
        )}
        {tab === 'setup' && showModSetup && (
          <div className="p-4">
            <ModSlatePicker
              compact
              initialSeason={pickem.binding?.season}
              initialWeek={pickem.binding?.week}
              onSlateSaved={() => void pickem.reload()}
            />
          </div>
        )}
      </main>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
