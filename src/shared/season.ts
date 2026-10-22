/** Pickem DB season key (e.g. "2026", "2026-week0", "2025bowl"). */
export type PickemSeason = string;

/** Calendar year for scoreboard API lookups (e.g. "2026-week0" → 2026). */
export const scoreboardSeasonYear = (pickemSeason: PickemSeason): number => {
  const match = /^(\d{4})/.exec(pickemSeason.trim());
  if (!match) {
    throw new Error(`Invalid pickem season: ${pickemSeason}`);
  }
  return Number(match[1]);
};

export const encodePickemSeason = (pickemSeason: PickemSeason): string =>
  encodeURIComponent(pickemSeason.trim());
