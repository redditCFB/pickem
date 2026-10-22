import { settings } from '@devvit/web/server';

/** When true, moderators configure the weekly slate inside the expanded post. */
export const getInAppSlateConfig = async (): Promise<boolean> => {
  const value = await settings.get<boolean>('inAppSlateConfig');
  return value === true;
};
