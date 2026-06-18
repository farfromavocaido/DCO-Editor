// @ts-nocheck
export const fieldValue = (value: unknown) => {
  if (value && typeof value === 'object' && 'Url' in value) return (value as { Url?: string }).Url || '';
  if (value === undefined || value === null) return '';
  return String(value);
};

export const wrapPercent = (value: unknown) => {
  const text = fieldValue(value).trim();
  if (!text.endsWith('%')) return text;
  return `${text.slice(0, -1)}<span class="sym-pct">%</span>`;
};

/** Map a campaign asset path to the editor asset proxy URL. */
export const assetUrl = (src: string) => {
  if (!src) return '';
  const normalized = src.replace(/^\/+/, '').replace(/^assets\//, '');
  return `/assets/${normalized}`;
};

/**
 * Studio uses an empty background_image_url to mean "use the packaged size background".
 * Local preview should mirror that by falling back to sizeCreative.assets.background.
 */
export const previewBackgroundSrc = (feedBackground: unknown, packagedBackground?: string) => {
  const feed = fieldValue(feedBackground).trim();
  if (feed) {
    if (feed.startsWith('assets/')) return assetUrl(feed);
    if (feed.startsWith('/assets/')) return feed;
    return feed;
  }
  return assetUrl(packagedBackground || '');
};
