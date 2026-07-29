export type CampaignEntry = {
  id: string;
  name: string;
  file: string;
  /** Prefix used for exported HTML / ZIP filenames (e.g. SSE_DCO). */
  exportSlug: string;
  /**
   * Landing URL for static (non-Enabler) HTML5 `clickTag`.
   * When omitted, exporters fall back to the shared homepage default.
   */
  clickTag?: string;
};

export const DEFAULT_CAMPAIGN_ID = 'sse-dco';

export const CAMPAIGNS: CampaignEntry[] = [
  {
    id: 'sse-dco',
    name: 'SSE DCO',
    file: 'sse-dco-creative.json',
    exportSlug: 'SSE_DCO',
  },
  {
    id: 'sse-hiker-welcome',
    name: 'Hiker Keypad',
    file: 'sse-hiker-welcome-creative.json',
    exportSlug: 'SSE_Hiker_Welcome',
    // Tactical - Keypad 10.5% + £30
    clickTag: 'https://sseairtricity.com/uk/home/products/keypad-electricity',
  },
  {
    id: 'sse-keepyuppy-welcome',
    name: 'Keepy Uppy Welcome Credit',
    file: 'sse-keepyuppy-welcome-creative.json',
    exportSlug: 'SSE_KeepyUppy_Welcome',
    // Tactical - Elec 10% + £60
    clickTag: 'https://sseairtricity.com/uk/home/products/electricity-welcome-credit',
  },
  {
    id: 'sse-keepyuppy-discount',
    name: 'Keepy Uppy Top Discount',
    file: 'sse-keepyuppy-discount-creative.json',
    exportSlug: 'SSE_KeepyUppy_Discount',
    // Tactical - Elec 15%
    clickTag: 'https://sseairtricity.com/uk/home/products/electricity-top-discount',
  },
];

const byId = new Map(CAMPAIGNS.map((entry) => [entry.id, entry]));

export const listCampaigns = () => CAMPAIGNS.map(({ id, name, file, exportSlug }) => ({
  id,
  name,
  file,
  exportSlug,
}));

export const getCampaign = (campaignId: string | null | undefined): CampaignEntry => {
  const id = campaignId || DEFAULT_CAMPAIGN_ID;
  const entry = byId.get(id);
  if (!entry) {
    throw new Error(`Unknown campaign id: ${id}`);
  }
  return entry;
};

export const isRegisteredCampaignId = (campaignId: string | null | undefined): boolean => (
  Boolean(campaignId && byId.has(campaignId))
);

/** Per-campaign static clickTag when authored; otherwise `undefined` (caller default). */
export const clickTagForCampaign = (campaignId: string | null | undefined): string | undefined => {
  if (!campaignId || !byId.has(campaignId)) return undefined;
  return byId.get(campaignId)?.clickTag;
};

/** Non-DCO campaigns hosted on the statics preview Pages route. */
export const listStaticPreviewCampaigns = () => (
  CAMPAIGNS.filter((entry) => entry.id !== DEFAULT_CAMPAIGN_ID)
);
