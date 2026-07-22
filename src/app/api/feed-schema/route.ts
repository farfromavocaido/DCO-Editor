import { resolveCampaignId } from '@/server/campaign-query';
import { creativeDocumentPathFor } from '@/server/paths';
import { readFeedSchema } from '@/server/feed-schema';
import { jsonResponse, errorResponse } from '@/server/http';

export const runtime = 'nodejs';

export async function GET(request = new Request('http://localhost/api/feed-schema')) {
  try {
    const campaignId = resolveCampaignId(request);
    return jsonResponse(await readFeedSchema(creativeDocumentPathFor(campaignId)));
  } catch (error) {
    return errorResponse(error);
  }
}
