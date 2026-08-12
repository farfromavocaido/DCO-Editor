import feedFieldMapJson from '../../campaign/feed-field-map.json';
import { CREATIVE_AD_SIZES } from '@/lib/feed-background';
import {
  SIZE_OVERRIDABLE_TEXT_FIELDS,
  sizeTextFieldName,
} from '@/lib/feed-size-text';

export type FeedFieldMapFile = {
  version: number;
  updated?: string;
  notes?: string;
  studioProfileId?: number;
  studioProfileElement?: string;
  sizeOverridableTextFields?: string[];
  sizes?: string[];
  /** Studio dynamic-profile name → creative canonical name. Only list divergences. */
  studioToCanonical?: Record<string, string>;
};

export const FEED_FIELD_MAP = feedFieldMapJson as FeedFieldMapFile;

/** Studio → canonical aliases from the sidecar (empty = identity). */
export const studioToCanonicalFieldMap = (): Record<string, string> => (
  { ...(FEED_FIELD_MAP.studioToCanonical || {}) }
);

export const canonicalSizeOverrideFieldNames = () => {
  const bases = FEED_FIELD_MAP.sizeOverridableTextFields?.length
    ? FEED_FIELD_MAP.sizeOverridableTextFields
    : [...SIZE_OVERRIDABLE_TEXT_FIELDS];
  const sizes = FEED_FIELD_MAP.sizes?.length
    ? FEED_FIELD_MAP.sizes
    : [...CREATIVE_AD_SIZES];
  return bases.flatMap((base) => sizes.map((size) => sizeTextFieldName(base, size)));
};

/**
 * Remap Studio/dynamicContent keys onto creative canonical names.
 * Only fills a canonical key when it is missing; never overwrites an explicit canonical value.
 * Original Studio keys are retained.
 */
export const remapStudioRowToCanonical = (
  row: Record<string, unknown> | null | undefined,
  aliases: Record<string, string> = studioToCanonicalFieldMap(),
) => {
  const input = row || {};
  const out: Record<string, unknown> = { ...input };
  for (const [studioName, canonical] of Object.entries(aliases || {})) {
    if (!Object.prototype.hasOwnProperty.call(input, studioName)) continue;
    if (Object.prototype.hasOwnProperty.call(input, canonical)) continue;
    out[canonical] = input[studioName];
  }
  return out;
};
