import { resolveCampaignId } from '@/server/campaign-query';
import { creativeDocumentPathFor } from '@/server/paths';
import { writeFeedSchemaRows } from '@/server/feed-schema';
import { jsonResponse, errorResponse } from '@/server/http';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const campaignId = resolveCampaignId(request, body);
    return jsonResponse(await writeFeedSchemaRows(body.rows || [], creativeDocumentPathFor(campaignId)));
  } catch (error) {
    return errorResponse(error);
  }
}
