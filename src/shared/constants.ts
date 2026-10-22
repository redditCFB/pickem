import type { PickemMeta } from './types';

export const OFFICIAL_GROUP_ID = 6;

/** When pickem.states is unreachable (mods API down). */
export const FALLBACK_PICKEM_META: PickemMeta = {
  current_season: '2026',
  current_week: 1,
};

/** Typical weekly slate size; mods may choose fewer (or up to MAX). */
export const DEFAULT_SLATE_SIZE = 10;
/** @deprecated Prefer slate size from binding or games list. */
export const SLATE_SIZE = DEFAULT_SLATE_SIZE;

export const MIN_SLATE_SIZE = 1;
export const MAX_SLATE_SIZE = 15;

export const isValidSlateSize = (count: number): boolean =>
  Number.isInteger(count) &&
  count >= MIN_SLATE_SIZE &&
  count <= MAX_SLATE_SIZE;

export const slateSizeError = (count: number): string | null => {
  if (isValidSlateSize(count)) return null;
  return `Select between ${MIN_SLATE_SIZE} and ${MAX_SLATE_SIZE} games`;
};

export const SCOREBOARD_API_BASE =
  'https://scoreboard.redditcfb.com/api/v1';
export const MODS_API_BASE =
  'https://mods.redditcfb.com/api/devvit/v1';
export const CDN_LOGO_BASE = 'https://cdn.redditcfb.com/60x40/cfb';

export const POST_BINDING_PREFIX = 'post:';

/** Client poll interval when games are in progress or kick off soon. */
export const SLATE_POLL_ACTIVE_MS = 30_000;
/** Client poll interval when slate has unfinished games. */
export const SLATE_POLL_MS = 60_000;
