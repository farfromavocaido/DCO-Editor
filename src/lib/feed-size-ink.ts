import { CREATIVE_AD_SIZES } from '@/lib/feed-background';

/** MPU stores the default ink; other sizes may override via `{field}_{size}`. */
export const INK_DEFAULT_SIZE = '300x250' as const;

export const NAVY_HEADLINES_FIELD = 'navy_headlines_bool' as const;

/** Sizes that may carry an optional ink override column (excludes the MPU default). */
export const INK_OVERRIDE_SIZES = CREATIVE_AD_SIZES.filter(
  (size) => size !== INK_DEFAULT_SIZE,
) as readonly Exclude<(typeof CREATIVE_AD_SIZES)[number], typeof INK_DEFAULT_SIZE>[];

export const sizeInkFieldName = (size: string) => `${NAVY_HEADLINES_FIELD}_${size}`;

export const isSizeInkOverrideField = (name: string) => {
  const match = String(name || '').match(/^navy_headlines_bool_(\d+x\d+)$/);
  if (!match) return false;
  return (INK_OVERRIDE_SIZES as readonly string[]).includes(match[1]);
};

export const sizeInkFieldDefinitions = () => (
  INK_OVERRIDE_SIZES.map((size) => ({
    name: sizeInkFieldName(size),
    label: `Navy ink (${size})`,
    type: 'tri-state-bool' as const,
    group: 'Creative State Overrides',
    description: `Optional offers-0 ink for ${size}. Leave blank to use the 300×250 (MPU) navy_headlines_bool.`,
  }))
);

/** Blank / missing → inherit; explicit true/false → override. Never coerce blank to false. */
export const coerceTriStateBool = (value: unknown): boolean | '' => {
  if (value === true || value === false) return value;
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === '') return '';
    if (['true', '1', 'yes', 'on', 'navy'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off', 'white'].includes(normalized)) return false;
  }
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  return '';
};

export const coerceNavyHeadlinesDefault = (value: unknown): boolean => {
  const tri = coerceTriStateBool(value);
  return tri === true;
};

/**
 * Effective offers-0 navy ink for `size`.
 * 300×250 (and unknown/missing size) uses `navy_headlines_bool`.
 * Other sizes use their override when set; blank inherits the MPU default.
 * Caller still gates offers-0 (no ink class when offer_count ≠ 0).
 */
export const navyHeadlinesForSize = (
  row: Record<string, unknown> | null | undefined,
  size: string | null | undefined,
): boolean => {
  const defaultNavy = coerceNavyHeadlinesDefault(row?.[NAVY_HEADLINES_FIELD]);
  if (!size || size === INK_DEFAULT_SIZE) return defaultNavy;
  if (!(INK_OVERRIDE_SIZES as readonly string[]).includes(size)) return defaultNavy;
  const override = coerceTriStateBool(row?.[sizeInkFieldName(size)]);
  if (override === '') return defaultNavy;
  return override;
};

/**
 * Resolve effective ink into `navy_headlines_bool` for runtime/export consumers.
 * Sized override columns stay on the row for Studio round-trips.
 */
export const applySizeInkOverrideToRow = (
  row: Record<string, unknown> | null | undefined,
  size: string | null | undefined,
) => {
  const out: Record<string, unknown> = { ...(row || {}) };
  out[NAVY_HEADLINES_FIELD] = navyHeadlinesForSize(out, size);
  return out;
};

export const sizeInkOverrideFieldNameForSize = (size: string) => (
  size && size !== INK_DEFAULT_SIZE && (INK_OVERRIDE_SIZES as readonly string[]).includes(size)
    ? sizeInkFieldName(size)
    : null
);
