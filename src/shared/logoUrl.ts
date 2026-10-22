/** Devvit webviews block external img src; proxy logos through our server. */
export const getLogoProxyUrl = (flairSlug: string): string =>
  `/api/logo/${encodeURIComponent(flairSlug)}`;
