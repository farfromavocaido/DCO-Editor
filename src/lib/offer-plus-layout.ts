/**
 * Offer plus placement mode.
 *
 * - `auto` — `layoutOffers` equalizes gaps and places `#plus-1` / `#plus-2`
 *   from value/subline ink (SSE DCO / live feed).
 * - `manual` — authored CSS / inspector positions win for pluses/slots; layout
 *   clears stale inline left/top then skips gap equalize + placePlus. Side-by-side
 *   subline ink lock still runs. Outline/static export bakes live host boxes from
 *   the editor presentation snapshot (direct WYSIWYG).
 */

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
