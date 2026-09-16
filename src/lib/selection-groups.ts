// @ts-nocheck
import { findCreativeComponent, componentForTarget, componentBounds } from "./creative-components";
import { findCanvasGroup, canvasGroupForMember } from "./canvas-groups";

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
  const parsed = Number(offerCount);
  const count = Number.isFinite(parsed) ? Math.max(0, Math.min(3, parsed)) : 1;
  if (count === 0) return [];
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
    const selectedComponent = findCreativeComponent(document, size, deepestTargetId);
    if (selectedComponent) return [selectedComponent.id];
    const component = componentForTarget(document, size, deepestTargetId);
    const selectedGroup = findCanvasGroup(document, size, deepestTargetId);
    if (selectedGroup) return [selectedGroup.id];
    const group = canvasGroupForMember(document, size, deepestTargetId);
    const path = selectionPathForTarget(document, size, deepestTargetId, activeScopes, offerCount);
    const componentPath = component ? [component.id, ...path] : path;
    if (group) return [group.id, ...componentPath.filter((id) => id !== OFFERS_BLOCK_ID)];
    return componentPath;
  }

  const parsedCount = Number(offerCount);
  const count = Number.isFinite(parsedCount) ? Math.max(0, Math.min(3, parsedCount)) : 1;
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

export const resolveLayerIdForSelection = (targetId: string, document: any = null, size = '') => {
  const component = findCreativeComponent(document, size, targetId);
  if (component) return parseCreativeTargetId(component.parts[0]?.targetId || "").layerId;
  const group = findCanvasGroup(document, size, targetId);
  if (group) return parseCreativeTargetId(group.members[0]).layerId;
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
  const componentMembers = (id) => findCreativeComponent(document, size, id)?.parts.map((part) => part.targetId);
  const groupMembers = (id) => componentMembers(id) || findCanvasGroup(document, size, id)?.members || [id];
  if (selectedTargetIds.some((id) => findCanvasGroup(document, size, id) || findCreativeComponent(document, size, id))) {
    return [...new Set(selectedTargetIds.flatMap(groupMembers))];
  }
  const component = componentMembers(selectedTargetId);
  if (component) return component;
  const group = findCanvasGroup(document, size, selectedTargetId);
  if (group) return group.members;
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
  const component = findCreativeComponent(document, size, selectedTargetId);
  if (component && selectedTargetIds.length <= 1) {
    const bounds = componentBounds(document, size, component.id, activeScopes);
    return { id: component.id, componentId: component.id, label: component.name, kind: 'component',
      coordinateScope: 'canvas', bounds, values: bounds || {}, fit: {},
      resize: component.resize, frameTargetId: component.frameTargetId,
      parts: component.parts, members: component.parts.map((part) => part.targetId),
      description: 'Double-click to edit parts.' };
  }
  const canvasGroup = findCanvasGroup(document, size, selectedTargetId);
  if (canvasGroup && selectedTargetIds.length <= 1) return {
    id: canvasGroup.id, label: canvasGroup.name, kind: 'group', coordinateScope: 'canvas',
    description: 'Canvas group. Move the members together; double-click to edit a child. Each child keeps its own motion and shared style.',
    bounds: getGroupCanvasBounds(document, size, canvasGroup.members, activeScopes), members: canvasGroup.members,
  };
  if (selectedTargetIds.length > 1) {
    const members = dragTargetIdsForSelection(selectedTargetId, selectedTargetIds, offerCount, document, size, activeScopes);
    const bounds = getGroupCanvasBounds(document, size, members, activeScopes);
    return {
      id: selectedTargetIds.join(','),
      label: `${members.length} items selected`,
      kind: 'multi',
      coordinateScope: 'canvas',
      description: 'Shift- or Cmd-click to add or remove items. Drag to move together.',
      bounds,
      members,
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

/** Layer-tree modifier clicks toggle explicit IDs, without canvas hit hierarchy. */
export const toggleExplicitTargetSelection = (currentTargetId: string, currentTargetIds: string[], targetId: string) => {
  const ids = new Set(currentTargetIds.length ? currentTargetIds : [currentTargetId].filter(Boolean));
  if (ids.has(targetId)) ids.delete(targetId);
  else ids.add(targetId);
  const selectedTargetIds = [...ids];
  return { selectedTargetId: selectedTargetIds.at(-1) || '', selectedTargetIds };
};
