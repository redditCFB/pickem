import type { Game, PickSubmission } from './types';
import {
  canonicalizePickSubmissions,
  isValidPickForGame,
} from './teamPick';

const slateSizeFromGames = (games: Game[]): number => games.length;

export type DraftPick = {
  game_id: string;
  pick: string | null;
  points: number | null;
};

export const sortGamesByKickoff = (games: Game[]): Game[] =>
  [...games].sort(
    (a, b) =>
      new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()
  );

export const isGameLocked = (game: Game): boolean =>
  game.is_locked_for_picks || game.status !== 'scheduled';

const pointsUsedByLockedGames = (
  draftPicks: DraftPick[],
  games: Game[]
): Set<number> => {
  const used = new Set<number>();
  for (const game of games) {
    if (!isGameLocked(game)) continue;
    const points = draftPicks.find((p) => p.game_id === game.id)?.points;
    if (points != null) used.add(points);
  }
  return used;
};

/** Remaining point values for unlocked games, highest first (top of list = most). */
export const availableUnlockedPointValues = (
  draftPicks: DraftPick[],
  games: Game[]
): number[] => {
  const lockedPoints = pointsUsedByLockedGames(draftPicks, games);
  return Array.from({ length: games.length }, (_, i) => i + 1)
    .filter((p) => !lockedPoints.has(p))
    .sort((a, b) => b - a);
};

/** Sort games by assigned points descending (highest first). */
export const sortGamesByPointsDesc = (
  games: Game[],
  draftPicks: DraftPick[]
): Game[] =>
  [...games].sort((a, b) => {
    const pa = draftPicks.find((d) => d.game_id === a.id)?.points ?? 0;
    const pb = draftPicks.find((d) => d.game_id === b.id)?.points ?? 0;
    if (pb !== pa) return pb - pa;
    return (
      new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()
    );
  });

/** Unlocked games in confidence order (most points / top first). */
export const getUnlockedGamesInDisplayOrder = (
  draftPicks: DraftPick[],
  games: Game[]
): Game[] => {
  const unlocked = games.filter((g) => !isGameLocked(g));
  const withPoints = unlocked.filter(
    (g) => draftPicks.find((p) => p.game_id === g.id)?.points != null
  );
  const withoutPoints = unlocked.filter(
    (g) => draftPicks.find((p) => p.game_id === g.id)?.points == null
  );

  return [
    ...sortGamesByPointsDesc(withPoints, draftPicks),
    ...sortGamesByKickoff(withoutPoints),
  ];
};

/** Unlocked high→low, then locked high→low at the bottom. */
export const getGamesInPickDisplayOrder = (
  draftPicks: DraftPick[],
  games: Game[]
): Game[] => {
  const unlocked = getUnlockedGamesInDisplayOrder(draftPicks, games);
  const locked = sortGamesByPointsDesc(
    games.filter((g) => isGameLocked(g)),
    draftPicks
  );
  return [...unlocked, ...locked];
};

/** Initial / reset: kickoff order with lowest remaining point on soonest unlocked game. */
export const assignPointsChronological = (
  draftPicks: DraftPick[],
  games: Game[]
): DraftPick[] => {
  const sorted = sortGamesByKickoff(games);
  const next = draftPicks.map((p) => ({ ...p }));
  const remaining = availableUnlockedPointValues(next, games).sort((a, b) => a - b);

  for (const game of sorted) {
    const pickIndex = next.findIndex((p) => p.game_id === game.id);
    const pick = pickIndex >= 0 ? next[pickIndex] : undefined;
    if (!pick) continue;

    const locked = isGameLocked(game);
    if (locked && pick.points != null) {
      if (!pick.pick) {
        next[pickIndex] = { ...pick, pick: game.away.short };
      }
      continue;
    }

    const value = remaining.shift();
    if (value === undefined) break;

    next[pickIndex] = {
      ...pick,
      points: value,
      pick: pick.pick ?? (locked ? game.away.short : null),
    };
  }

  return next;
};

/** Reassign unlocked points after drag. Locked picks/points are never modified. */
export const applyUnlockedOrder = (
  draftPicks: DraftPick[],
  games: Game[],
  orderedUnlockedIds: string[]
): DraftPick[] => {
  const values = availableUnlockedPointValues(draftPicks, games);
  const next = draftPicks.map((p) => ({ ...p }));

  orderedUnlockedIds.forEach((gameId, index) => {
    const value = values[index];
    const pickIndex = next.findIndex((p) => p.game_id === gameId);
    const pick = pickIndex >= 0 ? next[pickIndex] : undefined;
    if (pick && value !== undefined) {
      next[pickIndex] = { ...pick, points: value };
    }
  });

  return next;
};

export const reorderUnlockedPicks = (
  draftPicks: DraftPick[],
  games: Game[],
  fromIndex: number,
  toIndex: number
): DraftPick[] => {
  const orderedIds = getUnlockedGamesInDisplayOrder(draftPicks, games).map(
    (g) => g.id
  );
  if (
    fromIndex < 0 ||
    fromIndex >= orderedIds.length ||
    toIndex < 0 ||
    toIndex >= orderedIds.length ||
    fromIndex === toIndex
  ) {
    return draftPicks;
  }

  const nextIds = [...orderedIds];
  const [moved] = nextIds.splice(fromIndex, 1);
  if (!moved) return draftPicks;
  nextIds.splice(toIndex, 0, moved);

  return applyUnlockedOrder(draftPicks, games, nextIds);
};

export const assignPointsByKickoff = assignPointsChronological;

export const getAvailablePoints = (
  picks: DraftPick[],
  slateSize: number
): number[] => {
  const used = new Set(
    picks.map((p) => p.points).filter((p): p is number => p !== null)
  );
  return Array.from({ length: slateSize }, (_, i) => i + 1).filter(
    (p) => !used.has(p)
  );
};

export const validatePicks = (
  picks: PickSubmission[],
  games: Game[]
): string | null => {
  const slateSize = slateSizeFromGames(games);
  if (slateSize < 1) {
    return 'No games on the slate';
  }

  if (picks.length !== slateSize) {
    return `Expected ${slateSize} picks, got ${picks.length}`;
  }

  const gameMap = new Map(games.map((g) => [g.id, g]));
  const gameIds = new Set<string>();
  const points = new Set<number>();

  for (const pick of picks) {
    if (gameIds.has(pick.game_id)) {
      return 'Duplicate game in picks';
    }
    gameIds.add(pick.game_id);

    const game = gameMap.get(pick.game_id);
    if (!game) {
      return `Game ${pick.game_id} is not on the slate`;
    }

    if (!isValidPickForGame(pick.pick, game)) {
      return `Invalid pick for ${game.away.short} vs ${game.home.short}`;
    }

    if (pick.points < 1 || pick.points > slateSize) {
      return `Points must be between 1 and ${slateSize}`;
    }

    if (points.has(pick.points)) {
      return 'Each confidence point must be used exactly once';
    }
    points.add(pick.points);
  }

  if (points.size !== slateSize) {
    return `Points must be a permutation of 1..${slateSize}`;
  }

  return null;
};

/**
 * Fill missing picks/points before save. Locked games keep existing points;
 * lowest values go to locked games that still lack points.
 */
export const reshuffleUnselectedPicks = (
  draftPicks: DraftPick[],
  games: Game[]
): DraftPick[] => {
  const slateSize = slateSizeFromGames(games);
  const gameMap = new Map(games.map((g) => [g.id, g]));
  const result = draftPicks.map((p) => ({ ...p }));
  const pickMap = new Map(result.map((p) => [p.game_id, p]));

  const assignedPoints = new Set(
    result.map((p) => p.points).filter((p): p is number => p !== null)
  );

  for (const game of sortGamesByKickoff(games.filter((g) => isGameLocked(g)))) {
    const pick = pickMap.get(game.id);
    if (!pick) continue;

    if (pick.points === null) {
      const lowest = Array.from({ length: slateSize }, (_, i) => i + 1)
        .filter((p) => !assignedPoints.has(p))
        .sort((a, b) => a - b)[0];
      if (lowest !== undefined) {
        pick.points = lowest;
        assignedPoints.add(lowest);
      }
    }

    if (!pick.pick) {
      pick.pick = game.away.short;
    }
  }

  const remaining = Array.from({ length: slateSize }, (_, i) => i + 1)
    .filter((p) => !assignedPoints.has(p))
    .sort((a, b) => b - a);

  for (const game of sortGamesByKickoff(games.filter((g) => !isGameLocked(g)))) {
    const pick = pickMap.get(game.id);
    if (!pick || pick.points !== null) continue;

    const value = remaining.shift();
    if (value === undefined) break;
    pick.points = value;

    if (!pick.pick) {
      pick.pick = game.away.short;
    }
  }

  for (const pick of result) {
    const game = gameMap.get(pick.game_id);
    if (game && !pick.pick) {
      pick.pick = game.away.short;
    }
  }

  return result;
};

export const draftToSubmissions = (draft: DraftPick[]): PickSubmission[] =>
  draft
    .filter(
      (p): p is DraftPick & { pick: string; points: number } =>
        p.pick !== null && p.points !== null
    )
    .map((p) => ({
      game_id: p.game_id,
      pick: p.pick,
      points: p.points,
    }));

/** Merge partial submissions, fill locked games, then validate for save. */
export const finalizePicksForSave = (
  picks: PickSubmission[],
  games: Game[]
): PickSubmission[] => {
  const pickMap = new Map(picks.map((p) => [p.game_id, p]));
  let draft: DraftPick[] = sortGamesByKickoff(games).map((g) => {
    const existing = pickMap.get(g.id);
    return {
      game_id: g.id,
      pick: existing?.pick ?? null,
      points: existing?.points ?? null,
    };
  });

  if (draft.some((p) => p.points === null)) {
    draft = assignPointsChronological(draft, games);
  }

  if (draft.some((p) => p.pick === null || p.points === null)) {
    draft = reshuffleUnselectedPicks(draft, games);
  }

  return canonicalizePickSubmissions(draftToSubmissions(draft), games);
};

export const validatePicksForSave = (
  picks: PickSubmission[],
  games: Game[]
): string | null => {
  const error = validatePicks(picks, games);
  if (error) return error;

  // Locked games are included in submissions; ensure each has a valid pick.
  for (const game of games.filter((g) => isGameLocked(g))) {
    const submission = picks.find((p) => p.game_id === game.id);
    if (!submission) {
      return `Missing pick for locked game ${game.away.short} vs ${game.home.short}`;
    }
    if (!isValidPickForGame(submission.pick, game)) {
      return `Invalid pick for locked game ${game.away.short} vs ${game.home.short}`;
    }
  }

  return null;
};

export const collapseStandingsTies = (
  entries: { rank: number; username: string; total: number }[]
): { rank: number; usernames: string[]; total: number }[] => {
  const rows: { rank: number; usernames: string[]; total: number }[] = [];

  for (const entry of entries) {
    const last = rows[rows.length - 1];
    if (last && last.rank === entry.rank && last.total === entry.total) {
      last.usernames.push(entry.username);
    } else {
      rows.push({
        rank: entry.rank,
        usernames: [entry.username],
        total: entry.total,
      });
    }
  }

  return rows;
};
