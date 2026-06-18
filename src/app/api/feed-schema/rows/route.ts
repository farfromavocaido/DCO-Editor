import { writeFeedSchemaRows } from '@/server/feed-schema';
import { jsonResponse, errorResponse } from '@/server/http';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return jsonResponse(await writeFeedSchemaRows(body.rows || []));
  } catch (error) {
    return errorResponse(error);
  }
}
