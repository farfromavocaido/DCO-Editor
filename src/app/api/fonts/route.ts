import { listCampaignFontAssets, uploadCampaignFont, verifyCampaignFontCdn, loadCampaignFont } from '@/server/campaign-fonts';
import { resolveCampaignId } from '@/server/campaign-query';
import { jsonResponse, errorResponse } from '@/server/http';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try { resolveCampaignId(request); return jsonResponse({ assets: await listCampaignFontAssets() }); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  try {
    resolveCampaignId(request);
    if (request.headers.get('content-type')?.includes('multipart/form-data')) {
      if (Number(request.headers.get('content-length')) > 21 * 1024 * 1024) throw new Error('Font upload exceeds 20 MB');
      const data = await request.formData(); const file = data.get('file');
      if (!(file instanceof File)) throw new Error('A font file is required');
      if (file.size > 20 * 1024 * 1024) throw new Error('Font upload exceeds 20 MB');
      return jsonResponse(await uploadCampaignFont(file.name, Buffer.from(await file.arrayBuffer())));
    }
    const body = await request.json();
    if (body.action === 'verify') return jsonResponse(await verifyCampaignFontCdn(body.face));
    if (body.action === 'validate') { await loadCampaignFont(body.face); return jsonResponse({ valid: true }); }
    throw new Error('Unsupported font action');
  } catch (error) { return errorResponse(error); }
}
