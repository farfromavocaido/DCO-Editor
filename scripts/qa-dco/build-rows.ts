import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { backgroundImageFieldName, CREATIVE_AD_SIZES } from '../../src/lib/feed-background';

const here = path.dirname(fileURLToPath(import.meta.url));

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
  /** Capture step in ms (e.g. 250 = 4 fps). Full-res frames written at this rate. */
  intervalMs?: number;
  /**
   * Spritesheet step in ms (e.g. 1000 = 1 fps). Must be a multiple of `intervalMs`
   * so sheet cells map to captured frames. Defaults to 1000.
   */
  spritesheetIntervalMs?: number;
  /** Legacy alias: step = 1000 / fps. Used only when intervalMs is absent. */
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

export type MatrixRow = {
  sessionId: string;
  variantId: string;
  copySetId: string;
  row: Record<string, unknown>;
};

export const loadCopyMatrix = (matrixPath = path.resolve(here, 'copy-matrix.json')): CopyMatrix => (
  JSON.parse(fs.readFileSync(matrixPath, 'utf8')) as CopyMatrix
);

const reportingLabel = (variant: LayoutVariant, copySetId: string) => {
  const offerPart = `${variant.offer_count_num}offer`;
  const tcPart = variant.tc_type_enum === 'tcs_units' ? 'tc_prices' : 'tc_solo';
  const ctaPart = variant.cta_type_enum === 'rectangle' ? 'cta_rect' : 'cta_roundel';
  const roundelPart = variant.include_roundel_frame_bool ? 'roundel_on' : 'roundel_off';
  return `${offerPart}|${copySetId}|${tcPart}|${ctaPart}|${roundelPart}`;
};

export const buildFeedRow = (
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

export const expandMatrixRows = (
  matrix: CopyMatrix,
  filters: { variantIds?: string[]; copySetIds?: string[] } = {},
): MatrixRow[] => {
  const variants = matrix.variants.filter((variant) => (
    !filters.variantIds?.length || filters.variantIds.includes(variant.id)
  ));
  const copySets = matrix.copySets.filter((copySet) => (
    !filters.copySetIds?.length || filters.copySetIds.includes(copySet.id)
  ));

  const rows: MatrixRow[] = [];
  let index = 0;
  for (const variant of variants) {
    for (const copySet of copySets) {
      rows.push({
        sessionId: `${variant.id}__${copySet.id}`,
        variantId: variant.id,
        copySetId: copySet.id,
        row: buildFeedRow(matrix, variant, copySet, { index }),
      });
      index += 1;
    }
  }
  return rows;
};

export const captureIntervalMs = (matrix: Pick<CopyMatrix, 'intervalMs' | 'fps'>) => {
  if (matrix.intervalMs && matrix.intervalMs > 0) return matrix.intervalMs;
  if (matrix.fps && matrix.fps > 0) return 1000 / matrix.fps;
  return 250;
};

export const spritesheetIntervalMs = (
  matrix: Pick<CopyMatrix, 'spritesheetIntervalMs' | 'intervalMs' | 'fps'>,
) => {
  if (matrix.spritesheetIntervalMs && matrix.spritesheetIntervalMs > 0) {
    return matrix.spritesheetIntervalMs;
  }
  return 1000;
};

export const frameTimestampsMs = (durationS: number, intervalMs: number) => {
  const stepMs = intervalMs;
  const out: number[] = [];
  for (let t = 0; t <= durationS * 1000 + 0.001; t += stepMs) {
    out.push(Math.round(t));
  }
  return out;
};

/** All full-res capture timestamps (e.g. 4 fps). */
export const matrixFrameTimestamps = (matrix: CopyMatrix) => (
  frameTimestampsMs(matrix.durationS, captureIntervalMs(matrix))
);

/** Spritesheet cell timestamps (e.g. 1 fps subset of capture). */
export const matrixSpritesheetTimestamps = (matrix: CopyMatrix) => {
  const captureStep = captureIntervalMs(matrix);
  const sheetStep = spritesheetIntervalMs(matrix);
  if (sheetStep % captureStep !== 0) {
    throw new Error(
      `spritesheetIntervalMs (${sheetStep}) must be a multiple of intervalMs (${captureStep})`,
    );
  }
  return frameTimestampsMs(matrix.durationS, sheetStep);
};
