// @ts-nocheck

import { getTargetCanvasBounds } from '@/lib/canvas-alignment';
import { findCreativeTarget, parseCreativeTargetId, targetIdForLayerChild } from '@/lib/creative-model';
import { activeOfferMemberIds } from '@/lib/offer-interaction-model';
import { offerBlockLayerIds } from '@/lib/selection-groups';

const numberValue = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const expandScaleTargetIds = (memberIds: string[]) => {
  const ids = new Set<string>();
  for (const targetId of memberIds) {
    ids.add(targetId);
    const parsed = parseCreativeTargetId(targetId);
    if (!parsed.isNested && parsed.layerId.startsWith('offer-slot-')) {
      ids.add(targetIdForLayerChild(parsed.layerId, 'offer-value'));
      ids.add(targetIdForLayerChild(parsed.layerId, 'offer-subline'));
    }
  }
  return [...ids];
};

export const scaleTargetIdsForOfferGroup = (
  offerCount: number,
  document: Record<string, unknown> | null = null,
  size = '',
  activeScopes: string[] = [],
) => expandScaleTargetIds(
  document && size
    ? activeOfferMemberIds(document, size, activeScopes)
    : offerBlockLayerIds(offerCount),
);

export const groupResizeAnchor = (
  bounds: { left: number; top: number; width: number; height: number },
  handle: string,
) => {
  const right = bounds.left + bounds.width;
  const bottom = bounds.top + bounds.height;
  const centerX = bounds.left + bounds.width / 2;
  const centerY = bounds.top + bounds.height / 2;
  return {
    x: handle.includes('w') ? right : handle.includes('e') ? bounds.left : centerX,
    y: handle.includes('n') ? bottom : handle.includes('s') ? bounds.top : centerY,
  };
};

export const uniformScaleFromHandle = (
  startBounds: { width: number; height: number },
  handle: string,
  dx: number,
  dy: number,
) => {
  let nextWidth = startBounds.width;
  let nextHeight = startBounds.height;
  if (handle.includes('e')) nextWidth = startBounds.width + dx;
  if (handle.includes('w')) nextWidth = startBounds.width - dx;
  if (handle.includes('s')) nextHeight = startBounds.height + dy;
  if (handle.includes('n')) nextHeight = startBounds.height - dy;

  nextWidth = Math.max(4, nextWidth);
  nextHeight = Math.max(4, nextHeight);

  const scaleX = nextWidth / startBounds.width;
  const scaleY = nextHeight / startBounds.height;

  if (handle === 'e' || handle === 'w') return Math.max(0.05, scaleX);
  if (handle === 'n' || handle === 's') return Math.max(0.05, scaleY);
  return Math.max(0.05, Math.abs(scaleX) >= Math.abs(scaleY) ? scaleX : scaleY);
};

export const frameResizeWritesFromHandle = (
  start: { left: number; top: number; width: number; height: number },
  handle: string,
  dx: number,
  dy: number,
  { keepRatio = false, minSize = 4 } = {},
) => {
  const ratio = start.width && start.height ? start.width / start.height : 1;
  const next = { ...start };
  if (handle.includes('e')) next.width = Math.max(minSize, Math.round(start.width + dx));
  if (handle.includes('s')) next.height = Math.max(minSize, Math.round(start.height + dy));
  if (handle.includes('w')) {
    next.left = Math.round(start.left + dx);
    next.width = Math.max(minSize, Math.round(start.width - dx));
  }
  if (handle.includes('n')) {
    next.top = Math.round(start.top + dy);
    next.height = Math.max(minSize, Math.round(start.height - dy));
  }
  if (keepRatio && ratio) {
    if (handle.includes('e') || handle.includes('w')) next.height = Math.round(next.width / ratio);
    else next.width = Math.round(next.height * ratio);
  }

  const writes = [];
  if (handle.includes('w')) writes.push({ field: 'left', value: next.left });
  if (handle.includes('n')) writes.push({ field: 'top', value: next.top });
  if (handle.includes('e') || handle.includes('w') || (keepRatio && (handle.includes('n') || handle.includes('s')))) {
    writes.push({ field: 'width', value: next.width });
  }
  if (handle.includes('n') || handle.includes('s') || (keepRatio && (handle.includes('e') || handle.includes('w')))) {
    writes.push({ field: 'height', value: next.height });
  }

  return { next, writes };
};

export const buildGroupScaleSnapshots = (
  document: Record<string, unknown> | null,
  size: string,
  targetIds: string[],
  activeScopes: string[] = [],
) => (
  expandScaleTargetIds(targetIds)
    .map((targetId) => {
      const target = findCreativeTarget(document, size, targetId, activeScopes);
      const bounds = getTargetCanvasBounds(document, size, targetId, activeScopes);
      if (!target || !bounds) return null;
      return {
        targetId,
        kind: target.kind,
        bounds,
        raw: {
          left: target.values?.left,
          top: target.values?.top,
          width: target.values?.width,
          height: target.values?.height,
          fontSize: target.values?.fontSize,
        },
        numeric: {
          left: numberValue(bounds.localLeft ?? target.values?.left, 0),
          top: numberValue(bounds.localTop ?? target.values?.top, 0),
          width: bounds.width,
          height: bounds.height,
          fontSize: numberValue(target.values?.fontSize, 0),
        },
      };
    })
    .filter(Boolean)
);

export const scaledFieldWritesForSnapshot = (
  snapshot: ReturnType<typeof buildGroupScaleSnapshots>[number],
  scale: number,
  anchor: { x: number; y: number },
) => {
  const { bounds, kind, numeric } = snapshot;
  const writes: Array<{ field: string; value: number }> = [];

  if (kind === 'nested') {
    writes.push(
      { field: 'left', value: Math.round(numeric.left * scale) },
      { field: 'top', value: Math.round(numeric.top * scale) },
    );
  } else {
    writes.push(
      { field: 'left', value: Math.round(anchor.x + (bounds.left - anchor.x) * scale) },
      { field: 'top', value: Math.round(anchor.y + (bounds.top - anchor.y) * scale) },
    );
  }

  writes.push(
    { field: 'width', value: Math.max(4, Math.round(numeric.width * scale)) },
    { field: 'height', value: Math.max(4, Math.round(numeric.height * scale)) },
  );

  if (numeric.fontSize > 0) {
    writes.push({ field: 'fontSize', value: Math.max(4, Math.round(numeric.fontSize * scale)) });
  }

  return writes;
};

export const scaledResizeWritesFromHandle = (
  snapshot: ReturnType<typeof buildGroupScaleSnapshots>[number],
  handle: string,
  dx: number,
  dy: number,
) => {
  const scale = uniformScaleFromHandle(snapshot.bounds, handle, dx, dy);
  const anchor = groupResizeAnchor(snapshot.bounds, handle);
  return {
    scale,
    writes: scaledFieldWritesForSnapshot(snapshot, scale, anchor),
  };
};
