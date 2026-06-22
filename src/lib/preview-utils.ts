// @ts-nocheck
import { backgroundImageUrlForSize, imageFieldUrl } from '@/lib/feed-background';
import { wrapOfferValueSymbolsHtml } from '@/lib/offer-value-symbols';

export const fieldValue = (value: unknown) => {
  if (value && typeof value === 'object' && 'Url' in value) return (value as { Url?: string }).Url || '';
  if (value === undefined || value === null) return '';
  return String(value);
};

/** Wrap trailing % or leading £/€ in offer values for smaller symbol styling. */
export const wrapOfferValueSymbols = (value: unknown) => wrapOfferValueSymbolsHtml(fieldValue(value));

/** @deprecated Use wrapOfferValueSymbols */
export const wrapPercent = wrapOfferValueSymbols;

/** Map a campaign asset path to the editor asset proxy URL. */
export const assetUrl = (src: string) => {
  if (!src) return '';
  const normalized = src.replace(/^\/+/, '').replace(/^assets\//, '');
  return `/assets/${normalized}`;
};

/**
 * Studio uses an empty per-size background URL to mean "use the packaged size background".
 * Local preview should mirror that by falling back to sizeCreative.assets.background.
 */
export const previewBackgroundSrc = (
  row: Record<string, unknown> | null | undefined,
  size: string,
  packagedBackground?: string,
) => {
  const feed = backgroundImageUrlForSize(row, size);
  if (feed) {
    if (feed.startsWith('assets/')) return assetUrl(feed);
    if (feed.startsWith('/assets/')) return feed;
    return feed;
  }
  return assetUrl(packagedBackground || '');
};

/** @deprecated Prefer previewBackgroundSrc(row, size, packagedBackground). */
export const previewBackgroundSrcFromField = (feedBackground: unknown, packagedBackground?: string) => {
  const feed = imageFieldUrl(feedBackground);
  if (feed) {
    if (feed.startsWith('assets/')) return assetUrl(feed);
    if (feed.startsWith('/assets/')) return feed;
    return feed;
  }
  return assetUrl(packagedBackground || '');
};
