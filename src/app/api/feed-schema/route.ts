import { readFeedSchema } from '@/server/feed-schema';
import { jsonResponse, errorResponse } from '@/server/http';

export const runtime = 'nodejs';

export async function GET() {
  try {
    return jsonResponse(await readFeedSchema());
  } catch (error) {
    return errorResponse(error);
  }
}
