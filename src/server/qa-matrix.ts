import fs from 'node:fs';
import path from 'node:path';

import { backgroundImageFieldName, CREATIVE_AD_SIZES } from '@/lib/feed-background';
import { appRoot } from '@/server/paths';

export type CopyTier = 'short' | 'mid' | 'long' | 'long_alt';

export type LayoutVariant = {
  id: string;
  offer_count_num: number;
  include_roundel_frame_bool: boolean;
  tc_type_enum: 'tcs_only' | 'tcs_units';
  cta_type_enum: 'roundel' | 'rectangle';
};

export type CopySet = {
  id: string;
  headlines: CopyTier;
  offers: CopyTier;
  roundel: CopyTier;
  legal: CopyTier;
};

export type CopyMatrix = {
  sizes: string[];
  durationS: number;
  intervalMs?: number;
  spritesheetIntervalMs?: number;
  fps?: number;
  backgroundAssets: Record<string, string>;
  library: {
    headlines: Record<string, Record<string, string>>;
    offers: Record<string, Record<string, string>>;
    roundel: Record<string, Record<string, string>>;
    legal: Record<string, Record<string, string>>;
    cta: { offers: string; brand: string };
  };
  variants: LayoutVariant[];
  copySets: CopySet[];
};

export const QA_COPY_MATRIX_PATH = path.resolve(
  appRoot,
  'scripts/qa-dco/copy-matrix.json',
);

export const loadQaCopyMatrix = (
  matrixPath = QA_COPY_MATRIX_PATH,
): CopyMatrix => (
  JSON.parse(fs.readFileSync(matrixPath, 'utf8')) as CopyMatrix
);

const reportingLabel = (variant: LayoutVariant, copySetId: string) => {
  const offerPart = `${variant.offer_count_num}offer`;
  const tcPart = variant.tc_type_enum === 'tcs_units' ? 'tc_prices' : 'tc_solo';
  const ctaPart = variant.cta_type_enum === 'rectangle' ? 'cta_rect' : 'cta_roundel';
  const roundelPart = variant.include_roundel_frame_bool ? 'roundel_on' : 'roundel_off';
  return `${offerPart}|${copySetId}|${tcPart}|${ctaPart}|${roundelPart}`;
};

/** Build a feed row from matrix preset + variant (same shape as qa:dco capture). */
export const buildQaFeedRow = (
  matrix: CopyMatrix,
  variant: LayoutVariant,
  copySet: CopySet,
  options: { backgroundBaseUrl?: string; index?: number } = {},
): Record<string, unknown> => {
  const headlines = matrix.library.headlines[copySet.headlines] || {};
  const offers = matrix.library.offers[copySet.offers] || {};
  const roundel = matrix.library.roundel[copySet.roundel] || {};
  const legal = matrix.library.legal[copySet.legal] || {};
  const ctaText = variant.offer_count_num === 0
    ? matrix.library.cta.brand
    : matrix.library.cta.offers;

  const row: Record<string, unknown> = {
    _id: options.index ?? 0,
    Unique_ID: `${variant.id}__${copySet.id}`,
    Reporting_label: reportingLabel(variant, copySet.id),
    Active: true,
    Default: false,
    offer_count_num: variant.offer_count_num,
    include_roundel_frame_bool: variant.include_roundel_frame_bool,
    tc_type_enum: variant.tc_type_enum,
    cta_type_enum: variant.cta_type_enum,
    cta_text: ctaText,
    ...headlines,
    ...offers,
    ...roundel,
    ...legal,
  };

  const base = (options.backgroundBaseUrl || '').replace(/\/$/, '');
  for (const size of CREATIVE_AD_SIZES) {
    const relative = matrix.backgroundAssets[size] || '';
    const url = relative
      ? (base ? `${base}/${relative}` : relative)
      : '';
    row[backgroundImageFieldName(size)] = { Url: url };
  }

  return row;
};

/** Copy library fields for a preset id (`short` / `long`), without variant structure. */
export const copyFieldsForPreset = (
  matrix: CopyMatrix,
  copySetId: string,
): Record<string, string> => {
  const copySet = matrix.copySets.find((item) => item.id === copySetId);
  if (!copySet) return {};
  return {
    ...(matrix.library.headlines[copySet.headlines] || {}),
    ...(matrix.library.offers[copySet.offers] || {}),
    ...(matrix.library.roundel[copySet.roundel] || {}),
    ...(matrix.library.legal[copySet.legal] || {}),
  };
};
