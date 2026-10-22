import './index.css';

import { requestExpandedMode } from '@devvit/web/client';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { useSplash } from './hooks/useSplash';

export const Splash = () => {
  const { loading, binding, gameCount, modsAvailable, playtestMode, error } =
    useSplash();

  return (
    <div
      className="flex flex-col gap-3 p-4 bg-white dark:bg-gray-900 min-h-[200px] cursor-pointer"
      onClick={(e) => requestExpandedMode(e.nativeEvent, 'game')}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">
          {binding ? `Week ${binding.week} Pick 'Em` : 'Pick \'Em'}
        </h1>
        {playtestMode && (
          <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
            Preview
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <>
          {!modsAvailable && !playtestMode && (
            <p className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 rounded px-2 py-1">
              Pick&apos;em server reconnecting — expand to make picks.
            </p>
          )}
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {gameCount} games
            {gameCount > 0
              ? ` · Confidence points 1–${gameCount}`
              : ''}
          </p>
          <button
            type="button"
            className="mt-1 w-full py-2.5 rounded-full bg-[#d93900] text-white text-sm font-semibold hover:bg-[#c23300] transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              requestExpandedMode(e.nativeEvent, 'game');
            }}
          >
            Make your picks
          </button>
        </>
      )}
    </div>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);
