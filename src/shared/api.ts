import type {
  ApiError,
  Game,
  PickemMeta,
  PickSubmission,
  PostBinding,
  UserPick,
} from './types';

export type { ApiError };

export type BootstrapResponse = {
  type: 'bootstrap';
  postId: string;
  username: string | null;
  isLoggedIn: boolean;
  isModerator: boolean;
  inAppSlateConfig: boolean;
  binding: PostBinding;
  meta: PickemMeta;
  modsAvailable: boolean;
  playtestMode: boolean;
  liveScoreboard: boolean;
  games: Game[];
  gamesError: string | null;
  gamesCachedAt: string | null;
  scoreboardStale: boolean;
  picks: UserPick[];
  seasonTotal: number | null;
  picksPendingSync: boolean;
  fetchedAt: string;
};

export type SplashResponse = {
  type: 'splash';
  binding: PostBinding;
  gameCount: number;
  modsAvailable: boolean;
  playtestMode: boolean;
};

export type SlateResponse = {
  type: 'slate';
  games: Game[];
  binding: PostBinding;
  liveScoreboard: boolean;
  gamesError: string | null;
  gamesCachedAt: string | null;
  scoreboardStale: boolean;
  fetchedAt: string;
};

export type PicksResponse = {
  type: 'picks';
  picks: UserPick[];
  seasonTotal: number | null;
  pendingSync: boolean;
};

export type SavePicksRequest = {
  picks: PickSubmission[];
};

export type SavePicksResponse = {
  type: 'saved';
  picks: UserPick[];
  seasonTotal: number | null;
  pendingSync: boolean;
};

export type GamePoolResponse = {
  type: 'pool';
  games: Game[];
  meta: PickemMeta;
};

export type SaveSlateRequest = {
  season: string;
  week: number;
  game_ids: string[];
  multiplier?: number;
};

export type SaveSlateResponse = {
  type: 'slate_saved';
  binding: PostBinding;
};

export type ModSlateResponse = {
  type: 'mod_slate';
  season: string;
  week: number;
  game_ids: string[];
};

export type PublishPostRequest = {
  season: string;
  week: number;
  game_ids: string[];
  multiplier?: number;
};

export type PublishPostResponse = {
  type: 'published';
  postId: string;
  postUrl: string;
};
