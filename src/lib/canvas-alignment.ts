// @ts-nocheck

import {
  currentSizeCreative,
  editableTargetsForLayer,
  findCreativeTarget,
  targetIdForLayerChild,
} from '@/lib/creative-model';
import { applyFitBudgetToBox } from '@/lib/fit-box';
import { activeOfferMemberIds } from '@/lib/offer-interaction-model';

export const DEFAULT_SNAP_THRESHOLD = 5;

const numberValue = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const dimensionValue = (value: unknown, fallback: number, basis = fallback) => {
  if (typeof value === 'string' && value.trim().endsWith('%')) {
    const percent = Number.parseFloat(value);
    return Number.isFinite(percent) ? (basis * percent) / 100 : fallback;
  }
  return numberValue(value, fallback);
};

export const getTargetCanvasBounds = (
  document: Record<string, unknown> | null,
  size: string,
  targetId: string,
  activeScopes: string[] = [],
) => {
  const target = findCreativeTarget(document, size, targetId, activeScopes);
  if (!target) return null;

  const parentTarget = target.kind === 'nested'
    ? findCreativeTarget(document, size, target.parentLayerId, activeScopes)
    : null;
  const wrapper = target.wrapperBounds || null;
  const parentWidth = numberValue(
    parentTarget?.values?.width,
    numberValue(wrapper?.width, numberValue(target.values?.width, 80)),
  );
  const parentHeight = numberValue(
    parentTarget?.values?.height,
    numberValue(wrapper?.height, numberValue(target.values?.height, 40)),
  );
  const fontSize = numberValue(target.values?.fontSize, 22);
  const lineHeight = numberValue(target.values?.lineHeight, 1.15);
  const childLeft = numberValue(target.values?.left, 0);
  const childTop = numberValue(target.values?.top, 0);
  const width = dimensionValue(
    target.values?.width,
    target.kind === 'nested' || wrapper ? parentWidth : 80,
    parentWidth || 80,
  );
  const height = dimensionValue(target.values?.height, fontSize * lineHeight, parentHeight || 40);
  const originLeft = target.kind === 'nested'
    ? numberValue(parentTarget?.values?.left, 0)
    : numberValue(wrapper?.left, 0);
  const originTop = target.kind === 'nested'
    ? numberValue(parentTarget?.values?.top, 0)
    : numberValue(wrapper?.top, 0);
  const left = originLeft + childLeft;
  const top = originTop + childTop;

  // Legal lines emit authored top/height in CSS. Applying the maxLines budget
  // here rewrote top on every move and fought drag writes.
  // Offer/headline targets still grow the edit chrome to the line budget.
  const legalLine = /^(terms-prices|unit-rate-prices|terms-solo)$/.test(String(targetId || ''));
  if (wrapper || legalLine) {
    return {
      targetId,
      coordinateScope: target.coordinateScope,
      parentLayerId: target.parentLayerId || '',
      wrapperClass: target.wrapperClass || wrapper?.cssClass || '',
      left,
      top,
      width: Math.max(4, width),
      height: Math.max(4, height),
      localLeft: childLeft,
      localTop: childTop,
      wrapperWidth: numberValue(wrapper?.width, 0),
      wrapperHeight: numberValue(wrapper?.height, 0),
    };
  }

  // When fit.maxLines is set, selection/edit chrome uses that line budget as
  // height and shifts top so vertical alignment keeps its anchor edge.
  const fitted = applyFitBudgetToBox({
    top,
    height,
    localTop: childTop,
    values: target.values || {},
    fit: target.fit || target.layer?.fit || {},
  });

  return {
    targetId,
    coordinateScope: target.coordinateScope,
    parentLayerId: target.parentLayerId || '',
    wrapperClass: '',
    left,
    top: fitted.top,
    width: Math.max(4, width),
    height: Math.max(4, fitted.height),
    localLeft: childLeft,
    localTop: Number.isFinite(fitted.localTop) ? fitted.localTop : childTop,
    wrapperWidth: 0,
    wrapperHeight: 0,
  };
};

export const unionBounds = (bounds: Array<{ left: number; top: number; width: number; height: number }>) => {
  if (!bounds.length) return null;
  const left = Math.min(...bounds.map((item) => item.left));
  const top = Math.min(...bounds.map((item) => item.top));
  const right = Math.max(...bounds.map((item) => item.left + item.width));
  const bottom = Math.max(...bounds.map((item) => item.top + item.height));
  return {
    left,
    top,
    width: Math.max(4, right - left),
    height: Math.max(4, bottom - top),
  };
};

export const logicalOfferBlockBounds = (
  document: Record<string, unknown> | null,
  size: string,
  activeScopes: string[] = [],
) => unionBounds(
  activeOfferMemberIds(document, size, activeScopes)
    .map((targetId) => getTargetCanvasBounds(document, size, targetId, activeScopes))
    .filter(Boolean),
);

export const listSnapTargetIds = (
  document: Record<string, unknown> | null,
  size: string,
) => {
  const sizeCreative = currentSizeCreative(document, size);
  if (!sizeCreative) return [];
  const ids: string[] = [];
  for (const layer of sizeCreative.layers || []) {
    if (layer.id === 'bg-image') continue;
    ids.push(layer.id);
    for (const child of editableTargetsForLayer(layer)) {
      ids.push(child.id);
    }
  }
  return ids;
};

export const collectSnapBounds = (
  document: Record<string, unknown> | null,
  size: string,
  activeScopes: string[] = [],
  excludeTargetIds: string | string[] = '',
) => {
  const excluded = new Set(Array.isArray(excludeTargetIds) ? excludeTargetIds : [excludeTargetIds].filter(Boolean));
  return listSnapTargetIds(document, size)
    .filter((id) => !excluded.has(id))
    .map((id) => getTargetCanvasBounds(document, size, id, activeScopes))
    .filter(Boolean);
};

const snapAxis = (
  start: number,
  size: number,
  guides: number[],
  threshold: number,
) => {
  const edges = [start, start + size / 2, start + size];
  let bestDelta = threshold + 1;
  let bestStart = start;
  let matchedGuides: number[] = [];

  for (const guide of guides) {
    for (const edge of edges) {
      const delta = guide - edge;
      if (Math.abs(delta) > threshold) continue;
      if (Math.abs(delta) < Math.abs(bestDelta)) {
        bestDelta = delta;
        bestStart = start + delta;
        matchedGuides = [guide];
      } else if (Math.abs(delta) === Math.abs(bestDelta)) {
        matchedGuides.push(guide);
      }
    }
  }

  return {
    position: Math.round(bestStart),
    guides: [...new Set(matchedGuides)],
  };
};

export const computeSnap = (
  left: number,
  top: number,
  width: number,
  height: number,
  others: Array<{ left: number; top: number; width: number; height: number }>,
  canvas: { width: number; height: number },
  threshold = DEFAULT_SNAP_THRESHOLD,
  userGuides: { vertical?: number[]; horizontal?: number[] } = {},
) => {
  const xGuides = [0, canvas.width / 2, canvas.width, ...(userGuides.vertical || [])];
  const yGuides = [0, canvas.height / 2, canvas.height, ...(userGuides.horizontal || [])];

  for (const other of others) {
    xGuides.push(other.left, other.left + other.width / 2, other.left + other.width);
    yGuides.push(other.top, other.top + other.height / 2, other.top + other.height);
  }

  const snappedX = snapAxis(left, width, xGuides, threshold);
  const snappedY = snapAxis(top, height, yGuides, threshold);

  return {
    left: snappedX.position,
    top: snappedY.position,
    verticalGuides: snappedX.guides,
    horizontalGuides: snappedY.guides,
  };
};

export type AlignMode = 'left' | 'center-h' | 'right' | 'top' | 'center-v' | 'bottom';

export const computeAlignPosition = (
  bounds: {
    left: number;
    top: number;
    width: number;
    height: number;
    localLeft?: number;
    localTop?: number;
    coordinateScope?: string;
  },
  reference: { left: number; top: number; width: number; height: number },
  mode: AlignMode,
) => {
  let left = bounds.coordinateScope === 'group' ? bounds.localLeft ?? bounds.left : bounds.left;
  let top = bounds.coordinateScope === 'group' ? bounds.localTop ?? bounds.top : bounds.top;

  switch (mode) {
    case 'left':
      left = reference.left;
      break;
    case 'center-h':
      left = reference.left + (reference.width - bounds.width) / 2;
      break;
    case 'right':
      left = reference.left + reference.width - bounds.width;
      break;
    case 'top':
      top = reference.top;
      break;
    case 'center-v':
      top = reference.top + (reference.height - bounds.height) / 2;
      break;
    case 'bottom':
      top = reference.top + reference.height - bounds.height;
      break;
    default:
      break;
  }

  return {
    left: Math.round(left),
    top: Math.round(top),
  };
};

export const alignReferenceForTarget = (
  document: Record<string, unknown> | null,
  size: string,
  bounds: ReturnType<typeof getTargetCanvasBounds>,
  activeScopes: string[] = [],
) => {
  const sizeCreative = currentSizeCreative(document, size);
  if (!sizeCreative?.canvas) {
    return { left: 0, top: 0, width: 0, height: 0 };
  }
  if (bounds.coordinateScope === 'group' && bounds.parentLayerId) {
    const parent = getTargetCanvasBounds(document, size, bounds.parentLayerId, activeScopes);
    if (parent) {
      return { left: 0, top: 0, width: parent.width, height: parent.height };
    }
  }
  if (bounds.coordinateScope === 'group' && bounds.wrapperClass) {
    return {
      left: 0,
      top: 0,
      width: numberValue(bounds.wrapperWidth, sizeCreative.canvas.width),
      height: numberValue(bounds.wrapperHeight, sizeCreative.canvas.height),
    };
  }
  return {
    left: 0,
    top: 0,
    width: sizeCreative.canvas.width,
    height: sizeCreative.canvas.height,
  };
};

export const canvasReferenceForAlignment = (
  document: Record<string, unknown> | null,
  size: string,
  bounds: ReturnType<typeof getTargetCanvasBounds>,
  activeScopes: string[] = [],
) => {
  const reference = alignReferenceForTarget(document, size, bounds, activeScopes);
  if (bounds.coordinateScope === 'group' && bounds.parentLayerId) {
    const parent = getTargetCanvasBounds(document, size, bounds.parentLayerId, activeScopes);
    if (parent) {
      return {
        left: parent.left + reference.left,
        top: parent.top + reference.top,
        width: reference.width,
        height: reference.height,
      };
    }
  }
  if (bounds.coordinateScope === 'group' && bounds.wrapperClass) {
    const originLeft = numberValue(bounds.left, 0) - numberValue(bounds.localLeft, 0);
    const originTop = numberValue(bounds.top, 0) - numberValue(bounds.localTop, 0);
    return {
      left: originLeft + reference.left,
      top: originTop + reference.top,
      width: reference.width,
      height: reference.height,
    };
  }
  return reference;
};

export const alignmentGuidesForMode = (
  mode: AlignMode,
  reference: { left: number; top: number; width: number; height: number },
) => {
  const vertical: number[] = [];
  const horizontal: number[] = [];

  switch (mode) {
    case 'left':
      vertical.push(reference.left);
      break;
    case 'center-h':
      vertical.push(reference.left + reference.width / 2);
      break;
    case 'right':
      vertical.push(reference.left + reference.width);
      break;
    case 'top':
      horizontal.push(reference.top);
      break;
    case 'center-v':
      horizontal.push(reference.top + reference.height / 2);
      break;
    case 'bottom':
      horizontal.push(reference.top + reference.height);
      break;
    default:
      break;
  }

  return { vertical, horizontal };
};

export const computeGroupAlignDelta = (
  groupBounds: { left: number; top: number; width: number; height: number },
  reference: { left: number; top: number; width: number; height: number },
  mode: AlignMode,
) => {
  const aligned = computeAlignPosition(
    { ...groupBounds, coordinateScope: 'canvas' },
    reference,
    mode,
  );
  return {
    dx: ['left', 'center-h', 'right'].includes(mode) ? aligned.left - groupBounds.left : 0,
    dy: ['top', 'center-v', 'bottom'].includes(mode) ? aligned.top - groupBounds.top : 0,
  };
};

export type DistributeAxis = 'h' | 'v';

export const computeHorizontalDistribute = (
  items: Array<{ targetId: string; left: number; width: number }>,
) => {
  if (items.length < 2) return null;
  const sorted = [...items].sort((a, b) => a.left - b.left);
  const spanLeft = sorted[0].left;
  const spanRight = sorted[sorted.length - 1].left + sorted[sorted.length - 1].width;
  const totalWidth = sorted.reduce((sum, item) => sum + item.width, 0);
  const gap = (spanRight - spanLeft - totalWidth) / (sorted.length - 1);
  let cursor = spanLeft;
  return sorted.map((item) => {
    const left = Math.round(cursor);
    cursor += item.width + gap;
    return { targetId: item.targetId, left };
  });
};

export const computeVerticalDistribute = (
  items: Array<{ targetId: string; top: number; height: number }>,
) => {
  if (items.length < 2) return null;
  const sorted = [...items].sort((a, b) => a.top - b.top);
  const spanTop = sorted[0].top;
  const spanBottom = sorted[sorted.length - 1].top + sorted[sorted.length - 1].height;
  const totalHeight = sorted.reduce((sum, item) => sum + item.height, 0);
  const gap = (spanBottom - spanTop - totalHeight) / (sorted.length - 1);
  let cursor = spanTop;
  return sorted.map((item) => {
    const top = Math.round(cursor);
    cursor += item.height + gap;
    return { targetId: item.targetId, top };
  });
};

export const distributeGuidesForAxis = (
  axis: DistributeAxis,
  items: Array<{ left: number; top: number; width: number; height: number }>,
) => {
  if (items.length < 2) return { vertical: [], horizontal: [] };
  const sorted = axis === 'h'
    ? [...items].sort((a, b) => a.left - b.left)
    : [...items].sort((a, b) => a.top - b.top);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (axis === 'h') {
    return {
      vertical: [
        first.left,
        first.left + first.width / 2,
        last.left + last.width,
      ],
      horizontal: [],
    };
  }
  return {
    vertical: [],
    horizontal: [
      first.top,
      first.top + first.height / 2,
      last.top + last.height,
    ],
  };
};
