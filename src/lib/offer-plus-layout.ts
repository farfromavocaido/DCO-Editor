/**
 * Offer plus placement mode.
 *
 * - `auto` — `layoutOffers` equalizes gaps and places `#plus-1` / `#plus-2`
 *   from value/subline ink (SSE DCO / live feed).
 * - `manual` — authored CSS / inspector positions win; layout clears stale
 *   inline left/top then skips gap equalize + placePlus. Used by fixed-copy
 *   non-DCO campaigns so outline/static exports match designer placement.
 */

import type { PresentationSnapshots, SizePresentationSnapshot } from '@/lib/outline-snapshot';

export type OfferPlusLayout = 'auto' | 'manual';

export const OFFER_PLUS_LAYOUT_ATTR = 'data-offer-plus-layout';

/** Keep in sync with `DEFAULT_CAMPAIGN_ID` in campaign-registry (avoid server import in client). */
const DCO_CAMPAIGN_ID = 'sse-dco';

type CampaignLike = {
  id?: string;
  offerPlusLayout?: unknown;
};

type DocumentLike = {
  campaign?: CampaignLike | null;
} | null | undefined;

export const resolveOfferPlusLayout = (document?: DocumentLike): OfferPlusLayout => {
  const raw = document?.campaign?.offerPlusLayout;
  if (raw === 'manual' || raw === 'auto') return raw;
  const id = document?.campaign?.id;
  // Fixed-copy non-DCO defaults to manual even when the field is omitted.
  if (id && id !== DCO_CAMPAIGN_ID) return 'manual';
  return 'auto';
};

/** Drop auto-laid-out slot/plus XY so outline bake falls through to class CSS. */
export const stripAutoOfferPositions = (
  snapshot: SizePresentationSnapshot | null | undefined,
): SizePresentationSnapshot | null | undefined => {
  if (!snapshot?.positions) return snapshot;
  const positions = { ...snapshot.positions };
  for (const key of Object.keys(positions)) {
    if (
      key === 'plus-1'
      || key === 'plus-2'
      || key.startsWith('plus-')
      || /^offer\d+$/.test(key)
      || key.startsWith('offer-slot-')
    ) {
      delete positions[key];
    }
  }
  return { ...snapshot, positions };
};

export const presentationSnapshotsForOfferPlusLayout = (
  document: DocumentLike,
  snapshots: PresentationSnapshots | null | undefined,
): PresentationSnapshots | null | undefined => {
  if (!snapshots || resolveOfferPlusLayout(document) !== 'manual') return snapshots;
  const next: PresentationSnapshots = {};
  for (const [size, snapshot] of Object.entries(snapshots)) {
    next[size] = stripAutoOfferPositions(snapshot) || snapshot;
  }
  return next;
};
