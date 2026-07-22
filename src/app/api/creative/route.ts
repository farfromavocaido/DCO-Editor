import {
  readCreativeDocumentForCampaign,
  writeCreativeDocumentForCampaign,
} from '@/server/creative-document';
import { resolveCampaignId } from '@/server/campaign-query';
import { jsonResponse, errorResponse } from '@/server/http';

export const runtime = 'nodejs';

export async function GET(request = new Request('http://localhost/api/creative')) {
  try {
    const campaignId = resolveCampaignId(request);
    return jsonResponse(await readCreativeDocumentForCampaign(campaignId));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request = new Request('http://localhost/api/creative', { method: 'POST' })) {
  try {
    const body = await request.json();
    // Campaign id comes from ?campaign= (body.campaign is the document's { id, name } object).
    const campaignId = resolveCampaignId(request);
    return jsonResponse(await writeCreativeDocumentForCampaign(body, campaignId));
  } catch (error) {
    return errorResponse(error);
  }
}
