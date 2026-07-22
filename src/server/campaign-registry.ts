export type CampaignEntry = {
  id: string;
  name: string;
  file: string;
  /** Prefix used for exported HTML / ZIP filenames (e.g. SSE_DCO). */
  exportSlug: string;
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
    name: 'Hiker Welcome Credit',
    file: 'sse-hiker-welcome-creative.json',
    exportSlug: 'SSE_Hiker_Welcome',
  },
  {
    id: 'sse-keepyuppy-welcome',
    name: 'Keepy Uppy Welcome Credit',
    file: 'sse-keepyuppy-welcome-creative.json',
    exportSlug: 'SSE_KeepyUppy_Welcome',
  },
  {
    id: 'sse-keepyuppy-discount',
    name: 'Keepy Uppy Top Discount',
    file: 'sse-keepyuppy-discount-creative.json',
    exportSlug: 'SSE_KeepyUppy_Discount',
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
