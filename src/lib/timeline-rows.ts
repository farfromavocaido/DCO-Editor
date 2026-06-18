// @ts-nocheck

import { OFFERS_BLOCK_ID, offerBlockLayerIds } from '@/lib/selection-groups';

export const isOfferTimelineLayer = (layerId: string) => (
  layerId.startsWith('offer-slot-') || layerId.startsWith('plus-')
);

export type OfferVariantState = 'active' | 'inactive' | 'neutral';

export const offerLayerVariantState = (
  layerId: string,
  offerCount: number,
  activeOfferMemberIds: string[] | null = null,
): OfferVariantState => {
  if (!isOfferTimelineLayer(layerId)) return 'neutral';
  const activeIds = activeOfferMemberIds || offerBlockLayerIds(offerCount);
  return activeIds.includes(layerId) ? 'active' : 'inactive';
};

export const buildTimelineEntries = (
  layers: Array<Record<string, unknown>> = [],
  offerCount: number,
  options: Record<string, unknown> = {},
) => {
  const activeIds = new Set(options.activeOfferMemberIds || offerBlockLayerIds(offerCount));
  const entries: Array<Record<string, unknown>> = [];
  let index = 0;

  while (index < layers.length) {
    const layer = layers[index];
    if (offerCount >= 2 && isOfferTimelineLayer(String(layer.id))) {
      const groupLayers = [];
      while (index < layers.length && isOfferTimelineLayer(String(layers[index].id))) {
        groupLayers.push(layers[index]);
        index += 1;
      }
      const activeLayers = groupLayers.filter((groupLayer) => activeIds.has(String(groupLayer.id)));
      const hiddenLayers = groupLayers.filter((groupLayer) => !activeIds.has(String(groupLayer.id)));
      entries.push({
        kind: 'offers-group',
        id: OFFERS_BLOCK_ID,
        label: `Offers · ${offerCount}`,
        layers: activeLayers,
        hiddenLayers,
      });
    } else {
      entries.push({ kind: 'layer', layer });
      index += 1;
    }
  }

  return entries;
};

export const timelineLayerLabel = (
  layer: Record<string, unknown>,
  offerCount: number,
  activeOfferMemberIds: string[] | null = null,
) => {
  const state = offerLayerVariantState(String(layer.id), offerCount, activeOfferMemberIds);
  const base = layer.label || layer.id;
  if (state === 'inactive') return `${base} · alt`;
  return base;
};
