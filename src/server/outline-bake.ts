/**
 * Resolve outline bake inputs from an editor presentation snapshot when
 * present; otherwise approximate the same pipeline with Museo metrics
 * (shared size, tracking, bottom-align, 0.6em symbols).
 */

import {
  authoredLetterSpacingToEm,
  type SizePresentationSnapshot,
  type TextPresentationSnapshot,
} from '@/lib/outline-snapshot';
import { findCreativeTarget, isHeadlineLayer } from '@/lib/creative-model';
import { visibilityForLayer } from '@/lib/offer-interaction-model';
import { normalizeFitConfig } from '@/lib/text-fit-rules';
import { outlineFittedText, type OutlineFitOptions, type OutlinedText } from './text-outline';

const BRAND_TEXT_FILL = 'rgb(0, 41, 117)';

const pxNumber = (value: unknown, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

/** Matches campaign manualCss `.sse-text` / OfferSlot defaults when no color is authored. */
const resolveOutlineFillColor = ({
  values,
  targetId,
  cssClass,
  layer,
}: {
  values: Record<string, unknown>;
  targetId: string;
  cssClass?: string;
  layer?: Record<string, unknown> | null;
}) => {
  if (values.color) return String(values.color);
  const haystack = `${targetId} ${cssClass || ''} ${layer?.id || ''} ${layer?.base?.cssClass || ''}`;
  if (
    (layer && isHeadlineLayer(layer))
    || /offer-value|offer-subline|terms|unit-rate|sse-headline|sse-bottom|sse-text/.test(haystack)
  ) {
    return BRAND_TEXT_FILL;
  }
  if (layer?.base?.color) return String(layer.base.color);
  return BRAND_TEXT_FILL;
};

const snapshotKeyAliases = (targetId: string) => {
  const keys = [targetId];
  const offerNested = targetId.match(/^(offer-slot-(\d+))::(offer-value|offer-subline)$/);
  if (offerNested) {
    keys.push(`offer${offerNested[2]}::${offerNested[3]}`);
    keys.push(offerNested[3]);
  }
  if (targetId.startsWith('offer-slot-')) {
    keys.push(targetId.replace(/^offer-slot-/, 'offer'));
  }
  return keys;
};

export const textSnapshotForTarget = (
  snapshot: SizePresentationSnapshot | null | undefined,
  targetId: string,
): TextPresentationSnapshot | null => {
  if (!snapshot?.texts) return null;
  for (const key of snapshotKeyAliases(targetId)) {
    if (snapshot.texts[key]) return snapshot.texts[key];
  }
  return null;
};

export const positionStyleAttr = (
  snapshot: SizePresentationSnapshot | null | undefined,
  ...ids: string[]
) => {
  if (!snapshot?.positions) return '';
  for (const id of ids) {
    const pos = snapshot.positions[id];
    if (!pos) continue;
    const parts = [`left:${pos.left}px`, `top:${pos.top}px`];
    if (Number.isFinite(pos.width)) parts.push(`width:${pos.width}px`);
    return ` style="${parts.join(';')}"`;
  }
  return '';
};

type BakeTargetArgs = {
  document: Record<string, unknown>;
  size: string;
  targetId: string;
  text: string;
  activeScopes: string[];
  fallbackFit?: Record<string, unknown>;
  snapshot?: SizePresentationSnapshot | null;
  /** When set (shared equalization pass), lock this font size. */
  lockedFontSize?: number;
};

const targetBakeOptions = ({
  document,
  size,
  targetId,
  text,
  activeScopes,
  fallbackFit = {},
  snapshot,
  lockedFontSize,
}: BakeTargetArgs): OutlineFitOptions & { baseFontSize: number; align: string } => {
  const target = findCreativeTarget(document, size, targetId, activeScopes);
  const values = target?.values || target?.base || {};
  const scaleOfferSymbols = /::offer-value$/.test(targetId) || target?.cssClass === 'offer-value';
  // text-fit-rules injects offer-value defaults (align/tracking); mirror them when
  // the classRule has no explicit fit so bottom-align still bakes without a snapshot.
  const offerValueDefaults = scaleOfferSymbols
    ? { align: 'bottom', tracking: { minEm: -0.05 } }
    : {};
  const fit = normalizeFitConfig({
    ...offerValueDefaults,
    ...(target?.fit || {}),
    ...fallbackFit,
  });
  const baseFontSize = pxNumber(values.fontSize, 12);
  const width = Math.max(1, pxNumber(values.width, 40));
  const height = Math.max(1, pxNumber(values.height, baseFontSize * 1.2));
  const lineHeight = Number(values.lineHeight);
  const color = resolveOutlineFillColor({
    values,
    targetId,
    cssClass: target?.cssClass,
    layer: target?.layer || target?.parentLayer || null,
  });
  const alignRaw = String(values.textAlign || values.align || 'left').toLowerCase();
  const textAlign = alignRaw === 'center' || alignRaw === 'right' ? alignRaw : 'left';
  const snap = textSnapshotForTarget(snapshot, targetId);
  const authoredTracking = authoredLetterSpacingToEm(values.letterSpacing, baseFontSize);
  const resolvedLineHeight = Number.isFinite(lineHeight) && lineHeight > 0 ? lineHeight : undefined;
  const lineRatio = resolvedLineHeight && resolvedLineHeight <= 4
    ? resolvedLineHeight
    : 1.15;

  if (snap && Number(snap.fontSize) > 0) {
    return {
      text: snap.text || text,
      fontSize: Number(snap.fontSize),
      width,
      height,
      color,
      textAlign,
      lineHeight: resolvedLineHeight,
      letterSpacingEm: Number(snap.letterSpacingEm) || 0,
      lockMetrics: true,
      allowShrink: false,
      wrap: Boolean(fit.wrap),
      maxLines: Number(fit.maxLines) || (fit.wrap ? 2 : 1),
      scaleOfferSymbols: snap.scaleOfferSymbols ?? scaleOfferSymbols,
      alignOffsetY: Number(snap.alignOffsetY) || 0,
      baseFontSize,
      align: String(fit.align || ''),
    };
  }

  const fontSize = Number.isFinite(lockedFontSize) && Number(lockedFontSize) > 0
    ? Number(lockedFontSize)
    : baseFontSize;
  const lockShared = Number.isFinite(lockedFontSize) && Number(lockedFontSize) > 0;
  // Shared equalization locks size only — tracking is recomputed per box at that
  // size (same as text-fit). Full lockMetrics is reserved for editor snapshots.
  const alignOffsetY = fit.align === 'bottom' && fontSize < baseFontSize - 0.25
    ? (baseFontSize - fontSize) * lineRatio
    : 0;

  return {
    text,
    fontSize,
    width,
    height,
    color,
    textAlign,
    lineHeight: resolvedLineHeight,
    letterSpacingEm: authoredTracking,
    lockMetrics: false,
    allowShrink: lockShared
      ? false
      : fit.allowShrink !== false && fit.static === undefined,
    wrap: Boolean(fit.wrap),
    maxLines: Number(fit.maxLines) || (fit.wrap ? 2 : 1),
    minFontSize: Number(fit.minFontSize) || Math.max(6, Math.round(baseFontSize * 0.5)),
    trackingMinEm: Number(fit.tracking?.minEm),
    scaleOfferSymbols,
    alignOffsetY,
    baseFontSize,
    align: String(fit.align || ''),
  };
};

/** Bake one text target (snapshot-locked or metric fit). */
export const bakeOutlinedText = async (args: BakeTargetArgs): Promise<OutlinedText> => {
  const { baseFontSize: _base, align: _align, ...options } = targetBakeOptions(args);
  return outlineFittedText(options);
};

/**
 * Fit visible offer values independently, then re-bake at the shared min size
 * (mirrors text-fit `shared: true`). Snapshots short-circuit — already equalized
 * in the editor.
 */
export const bakeOutlinedOfferSlotSvgs = async ({
  document,
  size,
  row,
  activeScopes,
  snapshot,
}: {
  document: Record<string, unknown>;
  size: string;
  row: Record<string, unknown>;
  activeScopes: string[];
  snapshot?: SizePresentationSnapshot | null;
}) => {
  const sizeCreative = document.sizes?.[size];
  const slots = (sizeCreative?.layers || []).filter((layer: Record<string, unknown>) => (
    String(layer.id || '').startsWith('offer-slot-')
    && visibilityForLayer(document, size, String(layer.id), activeScopes) !== 'hidden'
  ));

  type SlotPlan = {
    layer: Record<string, unknown>;
    index: string;
    valueText: string;
    subText: string;
    valueProbe?: OutlinedText;
  };

  const plans: SlotPlan[] = slots.map((layer: Record<string, unknown>) => {
    const index = String(layer.id).match(/(\d)$/)?.[1] || '1';
    return {
      layer,
      index,
      valueText: String(row[`offer${index}_value_text`] || ''),
      subText: String(row[`offer${index}_sub_text`] || ''),
    };
  });

  const hasValueSnapshots = plans.some((plan) => (
    textSnapshotForTarget(snapshot, `${plan.layer.id}::offer-value`)
  ));

  let sharedValueSize: number | undefined;
  if (!hasValueSnapshots) {
    const probes = await Promise.all(plans.map(async (plan) => {
      if (!plan.valueText.trim()) return null;
      const outlined = await bakeOutlinedText({
        document,
        size,
        targetId: `${plan.layer.id}::offer-value`,
        text: plan.valueText,
        activeScopes,
        fallbackFit: { mode: 'shrink', tracking: { minEm: -0.05 } },
        snapshot,
      });
      return outlined;
    }));
    const sizes = probes.filter(Boolean).map((item) => item!.fontSize);
    if (sizes.length) sharedValueSize = Math.min(...sizes);
    plans.forEach((plan, index) => {
      plan.valueProbe = probes[index] || undefined;
    });
  }

  const results: Record<string, { valueSvg: string; subSvg: string }> = {};
  for (const plan of plans) {
    const valueSvg = plan.valueText.trim()
      ? (await bakeOutlinedText({
        document,
        size,
        targetId: `${plan.layer.id}::offer-value`,
        text: plan.valueText,
        activeScopes,
        fallbackFit: { mode: 'shrink', tracking: { minEm: -0.05 }, align: 'bottom' },
        snapshot,
        lockedFontSize: sharedValueSize,
      })).svg
      : '';
    // Sublines: snapshot or independent fit (shared subline size across slots).
    const subSvg = plan.subText.trim()
      ? (await bakeOutlinedText({
        document,
        size,
        targetId: `${plan.layer.id}::offer-subline`,
        text: plan.subText,
        activeScopes,
        fallbackFit: { mode: 'shrink' },
        snapshot,
      })).svg
      : '';
    results[String(plan.layer.id)] = { valueSvg, subSvg };
  }

  // Second pass for shared subline size when no snapshots (match text-fit shared).
  if (!hasValueSnapshots) {
    const subProbes = await Promise.all(plans.map(async (plan) => {
      if (!plan.subText.trim()) return null;
      return bakeOutlinedText({
        document,
        size,
        targetId: `${plan.layer.id}::offer-subline`,
        text: plan.subText,
        activeScopes,
        fallbackFit: { mode: 'shrink' },
        snapshot,
      });
    }));
    const subSizes = subProbes.filter(Boolean).map((item) => item!.fontSize);
    if (subSizes.length > 1) {
      const sharedSub = Math.min(...subSizes);
      for (let index = 0; index < plans.length; index += 1) {
        const plan = plans[index];
        if (!plan.subText.trim()) continue;
        results[String(plan.layer.id)].subSvg = (await bakeOutlinedText({
          document,
          size,
          targetId: `${plan.layer.id}::offer-subline`,
          text: plan.subText,
          activeScopes,
          fallbackFit: { mode: 'shrink' },
          snapshot,
          lockedFontSize: sharedSub,
        })).svg;
      }
    }
  }

  return results;
};
