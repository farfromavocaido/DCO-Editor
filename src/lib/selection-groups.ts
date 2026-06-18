// @ts-nocheck

import {
  findCreativeTarget,
  parseCreativeTargetId,
  targetIdForLayerChild,
} from '@/lib/creative-model';
import {
  getTargetCanvasBounds,
  logicalOfferBlockBounds,
  unionBounds,
} from '@/lib/canvas-alignment';
import {
  OFFERS_BLOCK_ID,
  activeOfferMemberIds,
  isOfferLayerId,
  selectionPathForTarget,
} from '@/lib/offer-interaction-model';

export { OFFERS_BLOCK_ID };

export const isOfferRelatedTarget = (targetId: string) => (
  targetId === OFFERS_BLOCK_ID
  || /^offer-slot-\d/.test(targetId)
  || /^plus-\d/.test(targetId)
);

export const slotLayerIdForTarget = (targetId: string) => {
  if (targetId === OFFERS_BLOCK_ID) return '';
  const parsed = parseCreativeTargetId(targetId);
  if (parsed.layerId.startsWith('offer-slot-')) return parsed.layerId;
  if (parsed.layerId.startsWith('plus-')) return parsed.layerId;
  return '';
};

export const offerBlockLayerIds = (offerCount: number) => {
  const count = Math.max(1, Math.min(3, Number(offerCount) || 1));
  const ids = [];
  for (let index = 1; index <= count; index += 1) {
    ids.push(`offer-slot-${index}`);
  }
  for (let index = 1; index < count; index += 1) {
    ids.push(`plus-${index}`);
  }
  return ids;
};

export const offerBlockTargetIds = (
  document: Record<string, unknown> | null,
  size: string,
  offerCount: number,
  activeScopes: string[] = [],
) => {
  const activeMembers = activeOfferMemberIds(document, size, activeScopes);
  return activeMembers.length ? activeMembers : offerBlockLayerIds(offerCount);
};

export const isOfferBlockMember = (
  targetId: string,
  offerCount: number,
  document: Record<string, unknown> | null = null,
  size = '',
  activeScopes: string[] = [],
) => {
  if (targetId === OFFERS_BLOCK_ID) return offerCount >= 2;
  const parsed = parseCreativeTargetId(targetId);
  return offerBlockTargetIds(document, size, offerCount, activeScopes).includes(parsed.layerId);
};

export const filterActiveOfferMembers = (
  targetIds: string[],
  offerCount: number,
  document: Record<string, unknown> | null = null,
  size = '',
  activeScopes: string[] = [],
) => (
  targetIds.filter((targetId) => isOfferBlockMember(targetId, offerCount, document, size, activeScopes))
);

export const filterManipulationTargetIds = (
  targetIds: string[],
  document: Record<string, unknown> | null = null,
  size = '',
  activeScopes: string[] = [],
) => {
  if (!document || !size) return targetIds;
  const activeMembers = new Set(activeOfferMemberIds(document, size, activeScopes));
  return targetIds.filter((targetId) => {
    if (targetId === OFFERS_BLOCK_ID) return true;
    const parsed = parseCreativeTargetId(targetId);
    if (!isOfferLayerId(parsed.layerId)) return true;
    return activeMembers.has(parsed.layerId);
  });
};

export const selectionHierarchy = (
  deepestTargetId: string,
  offerCount: number,
  document: Record<string, unknown> | null = null,
  size = '',
  activeScopes: string[] = [],
) => {
  if (document && size) {
    return selectionPathForTarget(document, size, deepestTargetId, activeScopes, offerCount);
  }

  const count = Math.max(1, Math.min(3, Number(offerCount) || 1));
  if (deepestTargetId === OFFERS_BLOCK_ID) {
    return count >= 2 ? [OFFERS_BLOCK_ID] : [];
  }

  const hierarchy: string[] = [];
  const parsed = parseCreativeTargetId(deepestTargetId);
  const slotId = parsed.layerId.startsWith('offer-slot-') ? parsed.layerId : '';

  if (slotId || parsed.layerId.startsWith('plus-')) {
    if (count >= 2) hierarchy.push(OFFERS_BLOCK_ID);
    if (slotId) hierarchy.push(slotId);
    if (parsed.isNested) hierarchy.push(deepestTargetId);
    else if (parsed.layerId.startsWith('plus-')) hierarchy.push(parsed.layerId);
    return hierarchy;
  }

  return [deepestTargetId];
};

export const resolveLayerIdForSelection = (targetId: string) => {
  if (targetId === OFFERS_BLOCK_ID) return offerBlockLayerIds(2)[0] || 'offer-slot-1';
  return parseCreativeTargetId(targetId).layerId || targetId;
};

export const selectionClickKey = (clientX: number, clientY: number) => (
  `${Math.round(clientX / 4)},${Math.round(clientY / 4)}`
);

export const dragTargetIdsForSelection = (
  selectedTargetId: string,
  selectedTargetIds: string[],
  offerCount: number,
  document: Record<string, unknown> | null = null,
  size = '',
  activeScopes: string[] = [],
) => {
  if (selectedTargetIds.length > 1) {
    return [...new Set(selectedTargetIds)];
  }
  if (selectedTargetId === OFFERS_BLOCK_ID) {
    return offerBlockTargetIds(document, size, offerCount, activeScopes);
  }
  if (selectedTargetId) return [selectedTargetId];
  return [];
};

export const getGroupCanvasBounds = (
  document: Record<string, unknown> | null,
  size: string,
  targetIds: string[],
  activeScopes: string[] = [],
) => {
  const bounds = targetIds
    .map((targetId) => getTargetCanvasBounds(document, size, targetId, activeScopes))
    .filter(Boolean);
  return unionBounds(bounds);
};

export const resolveSelectionMeta = (
  document: Record<string, unknown> | null,
  size: string,
  selectedTargetId: string,
  selectedTargetIds: string[],
  offerCount: number,
  activeScopes: string[] = [],
) => {
  if (selectedTargetIds.length > 1) {
    const bounds = getGroupCanvasBounds(document, size, selectedTargetIds, activeScopes);
    return {
      id: selectedTargetIds.join(','),
      label: `${selectedTargetIds.length} items selected`,
      kind: 'multi',
      coordinateScope: 'canvas',
      description: 'Shift- or Cmd-click to add or remove items. Drag to move together.',
      bounds,
      members: selectedTargetIds,
    };
  }

  if (selectedTargetId === OFFERS_BLOCK_ID) {
    const members = offerBlockTargetIds(document, size, offerCount, activeScopes);
    const bounds = logicalOfferBlockBounds(document, size, activeScopes)
      || getGroupCanvasBounds(document, size, members, activeScopes);
    return {
      id: OFFERS_BLOCK_ID,
      label: `Offers block (${offerCount})`,
      kind: 'group',
      coordinateScope: 'canvas',
      description: 'Drag to move or scale the whole block. Double-click to edit individual slots and text.',
      bounds,
      boundsMode: 'logical',
      members,
    };
  }

  const target = findCreativeTarget(document, size, selectedTargetId, activeScopes);
  if (!target) return null;
  const bounds = getTargetCanvasBounds(document, size, selectedTargetId, activeScopes);
  return {
    ...target,
    bounds,
    members: [selectedTargetId],
  };
};

export const deriveSelectedTarget = (
  document: Record<string, unknown> | null,
  size: string,
  selectedTargetId: string,
  selectedLayerId: string,
  selectedTargetIds: string[],
  offerCount: number,
  activeScopes: string[] = [],
) => {
  const id = selectedTargetId || selectedLayerId;
  const meta = resolveSelectionMeta(
    document,
    size,
    id,
    selectedTargetIds,
    offerCount,
    activeScopes,
  );
  if (meta) return meta;
  return findCreativeTarget(document, size, id, activeScopes);
};

export const isolatedDrillHierarchy = (hierarchy: string[]) => (
  hierarchy.filter((id) => id !== OFFERS_BLOCK_ID)
);

export const isOffersBlockHierarchy = (hierarchy: string[]) => (
  hierarchy[0] === OFFERS_BLOCK_ID
);

export const targetMatchesSelection = (
  targetId: string,
  selectedTargetId: string,
  selectedTargetIds: string[],
  offerCount: number,
  isolatedGroupId = '',
) => {
  if (selectedTargetIds.length > 1) {
    return selectedTargetIds.includes(targetId);
  }
  if (selectedTargetId === OFFERS_BLOCK_ID) {
    if (isolatedGroupId !== OFFERS_BLOCK_ID) {
      return targetId === OFFERS_BLOCK_ID;
    }
    return offerBlockLayerIds(offerCount).includes(targetId)
      || targetId === OFFERS_BLOCK_ID;
  }
  if (selectedTargetId === targetId) return true;
  const parsed = parseCreativeTargetId(targetId);
  const selectedParsed = parseCreativeTargetId(selectedTargetId);
  if (selectedParsed.isNested) return false;
  if (selectedTargetId.startsWith('offer-slot-') && parsed.layerId === selectedTargetId) return true;
  return false;
};

export const linkedTargetIdsForSelection = (
  selectedTargetId: string,
  selectedTargetIds: string[],
  offerCount: number,
  isolatedGroupId = '',
) => {
  if (selectedTargetIds.length > 1) return selectedTargetIds;
  if (selectedTargetId === OFFERS_BLOCK_ID && isolatedGroupId !== OFFERS_BLOCK_ID) return [];
  if (selectedTargetId === OFFERS_BLOCK_ID) return offerBlockLayerIds(offerCount);
  if (selectedTargetId.includes('::')) {
    return [parseCreativeTargetId(selectedTargetId).layerId];
  }
  if (selectedTargetId.startsWith('offer-slot-')) {
    return [
      targetIdForLayerChild(selectedTargetId, 'offer-value'),
      targetIdForLayerChild(selectedTargetId, 'offer-subline'),
    ];
  }
  return [];
};
