import type { Game, PickSubmission, TeamInfo } from './types';

/** Alphanumeric token for fuzzy team matching (legacy MySQL / abbrev variants). */
export const normalizePickToken = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

export const pickTokensForTeam = (team: TeamInfo): string[] => {
  const tokens = new Set<string>();
  if (team.short) tokens.add(normalizePickToken(team.short));
  if (team.abbrev) tokens.add(normalizePickToken(team.abbrev));
  if (team.name) tokens.add(normalizePickToken(team.name));
  return [...tokens];
};

/**
 * Map a stored or user-entered pick label to the scoreboard pick string (`TeamInfo.short`).
 * Accepts legacy MySQL `away_shortened` values and ESPN abbrev when they refer to the same team.
 */
export const resolvePickForGame = (pick: string, game: Game): string | null => {
  const trimmed = pick.trim();
  if (!trimmed) return null;

  if (trimmed === game.away.short || trimmed === game.home.short) {
    return trimmed;
  }

  const token = normalizePickToken(trimmed);
  for (const team of [game.away, game.home]) {
    if (pickTokensForTeam(team).includes(token)) {
      return team.short;
    }
  }

  return null;
};

export const isValidPickForGame = (pick: string, game: Game): boolean =>
  resolvePickForGame(pick, game) !== null;

/** Normalize pick submissions to scoreboard `short` values before mods API write. */
export const canonicalizePickSubmissions = (
  picks: PickSubmission[],
  games: Game[]
): PickSubmission[] => {
  const gameMap = new Map(games.map((g) => [g.id, g]));

  return picks.map((submission) => {
    const game = gameMap.get(submission.game_id);
    if (!game) return submission;

    const resolved = resolvePickForGame(submission.pick, game);
    return resolved ? { ...submission, pick: resolved } : submission;
  });
};

export const resolveWinnerShort = (
  winner: string | null | undefined,
  away: TeamInfo,
  home: TeamInfo
): string | null => {
  if (!winner?.trim()) return null;

  const stub: Game = {
    id: '',
    season: 0,
    week: 0,
    kickoff_at: '',
    kickoff_et: '',
    is_locked_for_picks: false,
    status: 'scheduled',
    away,
    home,
    away_score: null,
    home_score: null,
    winner_short: null,
  };

  return resolvePickForGame(winner, stub);
};
