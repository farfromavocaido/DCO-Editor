import { CREATIVE_AD_SIZES } from '@/lib/feed-background';
import { normalizeFeedLineBreaks } from '@/lib/feed-text';

/** Feed copy fields that support optional per-size overrides (`{field}_{size}`). */
export const SIZE_OVERRIDABLE_TEXT_FIELDS = [
  'heading1_text',
  'heading2_text',
  'heading3_text',
  'heading4_text',
  'tc_units_text',
] as const;

export type SizeOverridableTextField = (typeof SIZE_OVERRIDABLE_TEXT_FIELDS)[number];

export const isSizeOverridableTextField = (name: string): name is SizeOverridableTextField => (
  (SIZE_OVERRIDABLE_TEXT_FIELDS as readonly string[]).includes(name)
);

export const sizeTextFieldName = (base: string, size: string) => `${base}_${size}`;

export const isSizeTextOverrideField = (name: string) => {
  const match = String(name || '').match(/^(.*)_(?:\d+x\d+)$/);
  if (!match) return false;
  return isSizeOverridableTextField(match[1]);
};

export const sizeTextFieldDefinitions = () => (
  SIZE_OVERRIDABLE_TEXT_FIELDS.flatMap((base) => CREATIVE_AD_SIZES.map((size) => ({
    name: sizeTextFieldName(base, size),
    label: `${baseLabel(base)} (${size})`,
    type: 'multiline' as const,
    group: 'Copy Overrides',
    description: `Optional ${base} override for ${size}. Leave blank to use the base field.`,
  })))
);

const baseLabel = (base: SizeOverridableTextField) => {
  if (base === 'tc_units_text') return 'Unit-rate text';
  const act = base.match(/^heading(\d)_text$/)?.[1];
  return act ? `Heading ${act}` : base;
};

/** Non-empty size override wins; blank/missing falls back to the base field. */
export const textFieldForSize = (
  row: Record<string, unknown> | null | undefined,
  base: string,
  size: string | null | undefined,
) => {
  if (size) {
    const sized = normalizeFeedLineBreaks(row?.[sizeTextFieldName(base, size)]);
    if (sized !== '') return sized;
  }
  return normalizeFeedLineBreaks(row?.[base]);
};

/**
 * Returns a shallow copy of `row` with overridable base fields resolved for `size`.
 * Sized override columns are preserved; base keys become the effective display values.
 */
export const applySizeTextOverridesToRow = (
  row: Record<string, unknown> | null | undefined,
  size: string | null | undefined,
) => {
  const out: Record<string, unknown> = { ...(row || {}) };
  for (const base of SIZE_OVERRIDABLE_TEXT_FIELDS) {
    out[base] = textFieldForSize(out, base, size);
  }
  return out;
};

export const sizeOverrideFieldNamesForSize = (size: string) => (
  SIZE_OVERRIDABLE_TEXT_FIELDS.map((base) => sizeTextFieldName(base, size))
);
