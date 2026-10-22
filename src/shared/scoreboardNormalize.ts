import type { Game, GameStatus, TeamDivision, TeamInfo } from './types';
import { resolveWinnerShort } from './teamPick';

export type ScoreboardTeamRaw = {
  name: string;
  short?: string;
  abbrev?: string;
  score?: number | null;
  logo_url?: string;
  flair_slug: string;
  conference?: string;
  division?: string;
};

export type ScoreboardGameRaw = {
  id: string;
  season: number;
  week: number;
  status: string;
  kickoff_at: string;
  kickoff_et?: string;
  kickoff_display?: string;
  is_locked_for_picks?: boolean;
  is_started?: boolean;
  is_final?: boolean;
  away: ScoreboardTeamRaw;
  home: ScoreboardTeamRaw;
  winner?: string | null;
};

const normalizeStatus = (status: string): GameStatus => {
  const value = status.toLowerCase().replace(/-/g, '_');
  if (value === 'in_progress' || value === 'live') return 'in_progress';
  if (value === 'final') return 'final';
  if (value === 'canceled' || value === 'cancelled') return 'canceled';
  if (value === 'postponed') return 'postponed';
  return 'scheduled';
};

const normalizeDivision = (value: string | undefined): TeamDivision | undefined => {
  if (value?.toLowerCase() === 'fcs') return 'fcs';
  if (value?.toLowerCase() === 'fbs') return 'fbs';
  return undefined;
};

const normalizeTeam = (team: ScoreboardTeamRaw): TeamInfo => {
  const division = normalizeDivision(team.division);
  // Pick id is scoreboard `short` (pickem abbreviated name). Do not fall back to ESPN abbrev.
  const pickShort = team.short?.trim() || team.name.trim();
  const base: TeamInfo = {
    short: pickShort,
    name: team.name,
    flair_slug: team.flair_slug,
    logo_url:
      team.logo_url ??
      `https://cdn.redditcfb.com/60x40/cfb/${team.flair_slug}.png`,
  };

  if (team.abbrev?.trim()) {
    base.abbrev = team.abbrev.trim();
  }

  if (team.conference) {
    base.conference = team.conference;
  }
  if (division) {
    base.division = division;
  }

  return base;
};

const scoreOrNull = (value: number | null | undefined): number | null =>
  typeof value === 'number' ? value : null;

export const normalizeScoreboardGame = (raw: ScoreboardGameRaw): Game => {
  const awayScore = scoreOrNull(raw.away.score);
  const homeScore = scoreOrNull(raw.home.score);
  const status = normalizeStatus(raw.status);
  const kickoffMs = new Date(raw.kickoff_at).getTime();
  const pastKickoff = Number.isFinite(kickoffMs) && Date.now() >= kickoffMs;

  const isLocked = Boolean(
    raw.is_locked_for_picks ??
      raw.is_started ??
      (pastKickoff || status !== 'scheduled')
  );

  const away = normalizeTeam(raw.away);
  const home = normalizeTeam(raw.home);

  return {
    id: raw.id,
    season: raw.season,
    week: raw.week,
    kickoff_at: raw.kickoff_at,
    kickoff_et: raw.kickoff_display ?? raw.kickoff_et ?? '',
    is_locked_for_picks: Boolean(isLocked),
    status,
    away,
    home,
    away_score: awayScore,
    home_score: homeScore,
    winner_short: resolveWinnerShort(raw.winner, away, home),
  };
};

export const normalizeScoreboardGames = (
  items: ScoreboardGameRaw[]
): Game[] => items.map(normalizeScoreboardGame);

/** Poll while any slate game could still change (scores or kickoff lock). */
export const needsLivePolling = (games: Game[]): boolean =>
  games.some(
    (g) =>
      g.status === 'scheduled' ||
      g.status === 'in_progress' ||
      (!g.is_locked_for_picks && g.status !== 'final' && g.status !== 'canceled')
  );

/** Faster poll cadence when games are live or kick off within 2 hours. */
export const needsActivePolling = (games: Game[]): boolean => {
  const twoHoursMs = 2 * 60 * 60 * 1000;
  const now = Date.now();

  return games.some((g) => {
    if (g.status === 'in_progress') return true;
    if (g.status !== 'scheduled' || g.is_locked_for_picks) return false;
    const kickoff = new Date(g.kickoff_at).getTime();
    return Number.isFinite(kickoff) && kickoff - now <= twoHoursMs;
  });
};

export const getPollIntervalMs = (games: Game[]): number => {
  if (needsActivePolling(games)) return 30_000;
  if (needsLivePolling(games)) return 60_000;
  return 0;
};

export const hasLiveScores = (game: Game): boolean =>
  game.away_score !== null && game.home_score !== null;
