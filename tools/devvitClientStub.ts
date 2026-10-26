/** Local stand-in for `@devvit/web/client`. Reddit's client only runs inside a post. */

export const requestExpandedMode = (
  event: Event,
  entrypoint = 'game'
): void => {
  event.preventDefault();
  const entry = entrypoint.replace(/[^a-z0-9-]/gi, '') || 'game';
  window.location.assign(`/${entry}.html${window.location.search}`);
};
