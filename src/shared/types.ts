export type TeamDivision = 'fbs' | 'fcs';

export type TeamInfo = {
  /** Pick identifier — matches scoreboard `short` and pickem `away_shortened` / `home_shortened`. */
  short: string;
  /** Full team name for display (e.g. "Ohio State Buckeyes"). */
  name: string;
  /** ESPN / broadcast abbrev — display only, not used as pick id. */
  abbrev?: string;
  flair_slug: string;
  logo_url: string;
  conference?: string;
  division?: TeamDivision;
};

export type GameStatus =
  | 'scheduled'
  | 'in_progress'
  | 'final'
  | 'canceled'
  | 'postponed';

export type Game = {
  id: string;
  season: number;
  week: number;
  kickoff_at: string;
  kickoff_et: string;
  is_locked_for_picks: boolean;
  status: GameStatus;
  away: TeamInfo;
  home: TeamInfo;
  away_score: number | null;
  home_score: number | null;
  winner_short: string | null;
};

export type PickSubmission = {
  game_id: string;
  pick: string;
  points: number;
};

export type UserPick = PickSubmission & {
  is_correct: boolean | null;
  points_earned: number | null;
};

export type PostBinding = {
  season: string;
  week: number;
  group_id: number;
  slate_game_ids: string[];
  multiplier?: number;
};

export type StandingsEntry = {
  rank: number;
  username: string;
  total: number;
};

export type StandingsRow = {
  rank: number;
  usernames: string[];
  total: number;
};

export type PickemMeta = {
  current_season: string;
  current_week: number;
};

export type ApiError = {
  status: 'error';
  message: string;
};
