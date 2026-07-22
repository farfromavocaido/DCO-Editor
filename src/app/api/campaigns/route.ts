import { listCampaigns } from '@/server/campaign-registry';
import { jsonResponse, errorResponse } from '@/server/http';

export const runtime = 'nodejs';

export async function GET() {
  try {
    return jsonResponse(listCampaigns());
  } catch (error) {
    return errorResponse(error);
  }
}
