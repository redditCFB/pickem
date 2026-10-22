import { SCOREBOARD_API_BASE } from '../../shared/constants';
import { scoreboardSeasonYear } from '../../shared/season';
import {
  normalizeScoreboardGame,
  normalizeScoreboardGames,
  type ScoreboardGameRaw,
} from '../../shared/scoreboardNormalize';
import type { Game } from '../../shared/types';

type ScoreboardListResponse = {
  ok: boolean;
  meta?: { season: number; week: number; count: number };
  items?: ScoreboardGameRaw[];
};

type ScoreboardItemResponse = {
  ok: boolean;
  item?: ScoreboardGameRaw;
};

export class ScoreboardApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'ScoreboardApiError';
  }
}

export const isScoreboardAvailable = async (): Promise<boolean> => {
  try {
    const url = `${SCOREBOARD_API_BASE}/games?season=2025&week=1&division=d1`;
    const res = await fetch(url);
    if (!res.ok) return false;
    const data: ScoreboardListResponse = await res.json();
    return Boolean(data.ok && data.items);
  } catch {
    return false;
  }
};

export const fetchGames = async (
  pickemSeason: string,
  week: number
): Promise<Game[]> => {
  const season = scoreboardSeasonYear(pickemSeason);
  const [fbsGames, fcsGames] = await Promise.all([
    fetchGamesByDivision(season, week, 'fbs'),
    fetchGamesByDivision(season, week, 'fcs'),
  ]);

  const byId = new Map<string, Game>();
  for (const game of [...fbsGames, ...fcsGames]) {
    byId.set(game.id, game);
  }

  return [...byId.values()].sort((a, b) =>
    a.kickoff_at.localeCompare(b.kickoff_at)
  );
};

const fetchGamesByDivision = async (
  season: number,
  week: number,
  division: 'fbs' | 'fcs'
): Promise<Game[]> => {
  const url = `${SCOREBOARD_API_BASE}/games?season=${season}&week=${week}&division=${division}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new ScoreboardApiError(
      `Scoreboard API error: ${res.status}`,
      res.status
    );
  }

  const data: ScoreboardListResponse = await res.json();
  if (!data.ok || !data.items) {
    throw new ScoreboardApiError('Invalid scoreboard response', 502);
  }

  return normalizeScoreboardGames(data.items);
};

export const fetchGame = async (
  gameId: string,
  season: number
): Promise<Game> => {
  const url = `${SCOREBOARD_API_BASE}/games/${gameId}?season=${season}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new ScoreboardApiError(
      `Scoreboard API error: ${res.status}`,
      res.status
    );
  }

  const data: ScoreboardItemResponse = await res.json();
  if (!data.ok || !data.item) {
    throw new ScoreboardApiError('Game not found', 404);
  }

  return normalizeScoreboardGame(data.item);
};

export const fetchSlateGames = async (
  gameIds: string[],
  pickemSeason: string,
  week: number
): Promise<Game[]> => {
  const pool = await fetchGames(pickemSeason, week);
  const byId = new Map(pool.map((game) => [game.id, game]));

  const missing: string[] = [];
  for (const id of gameIds) {
    if (!byId.has(String(id))) {
      missing.push(String(id));
    }
  }

  if (missing.length > 0) {
    const season = scoreboardSeasonYear(pickemSeason);
    for (const id of missing) {
      byId.set(id, await fetchGame(id, season));
    }
  }

  return gameIds.map((id) => {
    const game = byId.get(String(id));
    if (!game) {
      throw new ScoreboardApiError(`Game not found: ${id}`, 404);
    }
    return game;
  });
};
