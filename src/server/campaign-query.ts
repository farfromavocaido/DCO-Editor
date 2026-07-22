import { DEFAULT_CAMPAIGN_ID, getCampaign } from './campaign-registry';

const campaignIdFromUnknown = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string') {
    return String((value as { id: string }).id);
  }
  return null;
};

/** Resolve campaign id from a request URL search param, body field, or default. */
export const resolveCampaignId = (
  request: Request,
  body?: { campaign?: unknown } | null,
): string => {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get('campaign');
  const fromBody = campaignIdFromUnknown(body?.campaign);
  return getCampaign(fromQuery || fromBody || DEFAULT_CAMPAIGN_ID).id;
};
