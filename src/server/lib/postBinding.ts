import { redis } from '@devvit/web/server';
import { POST_BINDING_PREFIX } from '../../shared/constants';
import type { PostBinding } from '../../shared/types';

const bindingKey = (postId: string) => `${POST_BINDING_PREFIX}${postId}`;

const normalizeBinding = (binding: PostBinding): PostBinding => ({
  ...binding,
  season: String(binding.season).trim(),
});

export const getPostBinding = async (
  postId: string
): Promise<PostBinding | null> => {
  const raw = await redis.get(bindingKey(postId));
  if (!raw) return null;
  return normalizeBinding(JSON.parse(raw) as PostBinding);
};

export const setPostBinding = async (
  postId: string,
  binding: PostBinding
): Promise<void> => {
  await redis.set(bindingKey(postId), JSON.stringify(binding));
};

export const deletePostBinding = async (postId: string): Promise<void> => {
  await redis.del(bindingKey(postId));
};

export const getDraftSlate = async (): Promise<PostBinding | null> => {
  const raw = await redis.get('draft:slate');
  if (!raw) return null;
  return normalizeBinding(JSON.parse(raw) as PostBinding);
};

export const setDraftSlate = async (binding: PostBinding): Promise<void> => {
  await redis.set('draft:slate', JSON.stringify(binding));
};

const LAST_PUBLISHED_POST_KEY = 'pickem:lastPublishedPostId';

export const getLastPublishedPostId = async (): Promise<string | null> => {
  const id = await redis.get(LAST_PUBLISHED_POST_KEY);
  return id ?? null;
};

export const setLastPublishedPostId = async (postId: string): Promise<void> => {
  await redis.set(LAST_PUBLISHED_POST_KEY, postId);
};
