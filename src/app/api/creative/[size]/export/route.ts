import { resolveCampaignId } from '@/server/campaign-query';
import { readCreativeDocumentForCampaign } from '@/server/creative-document';
import { buildCreativeHtmlFiles } from '@/server/creative-exporter';
import { jsonResponse, errorResponse } from '@/server/http';

export const runtime = 'nodejs';

type Params = { params: Promise<{ size: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { size } = await params;
    let body: { campaign?: string; renderMode?: string } = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const campaignId = resolveCampaignId(request, body);
    const renderMode = body.renderMode === 'outline' ? 'outline' : 'font';
    const document = await readCreativeDocumentForCampaign(campaignId);
    return jsonResponse(await buildCreativeHtmlFiles(document, size, { renderMode }));
  } catch (error) {
    return errorResponse(error);
  }
}
