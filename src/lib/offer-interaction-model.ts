// @ts-nocheck

import {
  currentSizeCreative,
  editableTargetsForLayer,
  findCreativeLayer,
  parseCreativeTargetId,
} from './creative-model';

export const OFFERS_BLOCK_ID = 'group:offers-block';

export const isOfferLayerId = (layerId: string) => (
  /^offer-slot-\d$/.test(String(layerId || '')) || /^plus-\d$/.test(String(layerId || ''))
);

export const visibilityForLayer = (
  document: Record<string, unknown> | null,
  size: string,
  layerId: string,
  activeScopes: string[] = [],
) => {
  const sizeCreative = currentSizeCreative(document, size);
  const layer = findCreativeLayer(document, size, layerId);
  if (!sizeCreative || !layer) return 'hidden';
  const cssClass = layer.base?.cssClass || layer.id;
  const visibilityRules = (sizeCreative.variantRules || []).filter((rule: Record<string, unknown>) => (
    activeScopes.includes(String(rule.scope || ''))
    && (rule.layerId === layerId || rule.cssClass === cssClass)
    && rule.props?.visibility !== undefined
  ));
  const last = visibilityRules.at(-1);
  return last?.props?.visibility === 'hidden' ? 'hidden' : 'visible';
};

export const activeOfferMemberIds = (
  document: Record<string, unknown> | null,
  size: string,
  activeScopes: string[] = [],
) => {
  const sizeCreative = currentSizeCreative(document, size);
  if (!sizeCreative) return [];
  return (sizeCreative.layers || [])
    .map((layer: Record<string, unknown>) => String(layer.id || ''))
    .filter(isOfferLayerId)
    .filter((layerId: string) => visibilityForLayer(document, size, layerId, activeScopes) !== 'hidden');
};

export const offerInteractionTree = (
  document: Record<string, unknown> | null,
  size: string,
  activeScopes: string[] = [],
) => ({
  id: OFFERS_BLOCK_ID,
  label: 'Offers block',
  kind: 'offer-block',
  children: activeOfferMemberIds(document, size, activeScopes).map((layerId) => {
    const layer = findCreativeLayer(document, size, layerId);
    const isSlot = layerId.startsWith('offer-slot-');
    return {
      id: layerId,
      label: layer?.label || layerId,
      kind: isSlot ? 'offer-slot' : 'offer-plus',
      parentId: OFFERS_BLOCK_ID,
      children: isSlot ? editableTargetsForLayer(layer).map((target) => ({
        id: target.id,
        label: target.label,
        kind: 'offer-text',
        parentId: layerId,
        children: [],
      })) : [],
    };
  }),
});

export const selectionPathForTarget = (
  document: Record<string, unknown> | null,
  size: string,
  targetId: string,
  activeScopes: string[] = [],
  offerCount: number | null = null,
) => {
  const activeMembers = activeOfferMemberIds(document, size, activeScopes);
  const visibleSlotCount = activeMembers.filter((layerId) => layerId.startsWith('offer-slot-')).length;
  const count = Number(offerCount);
  const effectiveOfferCount = Number.isFinite(count) && count > 0 ? count : visibleSlotCount;
  if (targetId === OFFERS_BLOCK_ID) {
    return effectiveOfferCount >= 2 && visibleSlotCount >= 2 ? [OFFERS_BLOCK_ID] : [];
  }

  const parsed = parseCreativeTargetId(targetId);
  if (!isOfferLayerId(parsed.layerId)) {
    return parsed.isNested ? [parsed.layerId, targetId].filter(Boolean) : [targetId].filter(Boolean);
  }
  if (!activeMembers.includes(parsed.layerId)) return [];
  const path = effectiveOfferCount >= 2 && visibleSlotCount >= 2
    ? [OFFERS_BLOCK_ID, parsed.layerId]
    : [parsed.layerId];
  if (parsed.isNested) path.push(targetId);
  return path;
};
