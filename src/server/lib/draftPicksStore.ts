import { redis } from '@devvit/web/server';
import type { PostBinding, UserPick } from '../../shared/types';

const picksKey = (binding: PostBinding, username: string): string =>
  `pickem:picks:${binding.season}:${binding.week}:${binding.group_id}:${username.toLowerCase()}`;

type StoredUserPicks = {
  picks: UserPick[];
  savedAt: string;
  pendingSync: boolean;
};

const parseStored = (raw: string): StoredUserPicks | null => {
  try {
    const data = JSON.parse(raw) as StoredUserPicks;
    if (!Array.isArray(data.picks)) {
      return null;
    }
    return {
      picks: data.picks,
      savedAt: data.savedAt ?? new Date().toISOString(),
      pendingSync: data.pendingSync === true,
    };
  } catch {
    return null;
  }
};

export const getDraftUserPicks = async (
  binding: PostBinding,
  username: string
): Promise<StoredUserPicks | null> => {
  const raw = await redis.get(picksKey(binding, username));
  if (!raw) return null;
  return parseStored(raw);
};

export const setDraftUserPicks = async (
  binding: PostBinding,
  username: string,
  picks: UserPick[],
  pendingSync: boolean
): Promise<void> => {
  const payload: StoredUserPicks = {
    picks,
    savedAt: new Date().toISOString(),
    pendingSync,
  };
  await redis.set(picksKey(binding, username), JSON.stringify(payload));
};

export const clearDraftUserPicks = async (
  binding: PostBinding,
  username: string
): Promise<void> => {
  await redis.del(picksKey(binding, username));
};

/** @deprecated Use getDraftUserPicks */
export const getMockUserPicks = async (
  binding: PostBinding,
  username: string
): Promise<UserPick[] | null> => {
  const stored = await getDraftUserPicks(binding, username);
  return stored?.picks ?? null;
};

/** @deprecated Use setDraftUserPicks */
export const setMockUserPicks = async (
  binding: PostBinding,
  username: string,
  picks: UserPick[]
): Promise<void> => {
  await setDraftUserPicks(binding, username, picks, true);
};
