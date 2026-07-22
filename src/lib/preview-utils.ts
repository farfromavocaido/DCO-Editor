// @ts-nocheck
import { backgroundImageUrlForSize, imageFieldUrl } from '@/lib/feed-background';
import { wrapOfferValueSymbolsHtml } from '@/lib/offer-value-symbols';

export const fieldValue = (value: unknown) => {
  if (value && typeof value === 'object' && 'Url' in value) return (value as { Url?: string }).Url || '';
  if (value === undefined || value === null) return '';
  return String(value);
};

/**
 * Resolve the sample/feed field name for a canvas layer or offer child target
 * (e.g. offer-slot-1::offer-value → offer1_value_text).
 */
export const feedFieldForEditableTarget = (
  layer: Record<string, unknown> | null | undefined,
  targetId?: string | null,
) => {
  const id = String(targetId || layer?.id || '');
  const offerChild = id.match(/^offer-slot-(\d+)::offer-(value|subline)$/);
  if (offerChild) {
    return offerChild[2] === 'value'
      ? `offer${offerChild[1]}_value_text`
      : `offer${offerChild[1]}_sub_text`;
  }
  if (layer?.binding && typeof layer.binding === 'object' && (layer.binding as { field?: string }).field) {
    return String((layer.binding as { field: string }).field);
  }
  if (id === 'headline-act1') return 'heading1_text';
  if (id === 'headline-act2') return 'heading2_text';
  if (id === 'headline-act3') return 'heading3_text';
  if (id === 'headline-act4') return 'heading4_text';
  if (id === 'cta') return 'cta_text';
  if (id === 'terms-prices' || id === 'terms-solo') return 'tc_terms_text';
  if (id === 'unit-rate-prices') return 'tc_units_text';
  if (id === 'roundel-copy') return 'roundel_text_text';
  if (id === 'roundel-value') return 'roundel_value_text';
  const offerSlot = id.match(/^offer-slot-(\d+)$/);
  if (offerSlot) return `offer${offerSlot[1]}_value_text`;
  return '';
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
