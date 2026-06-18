import { readCreativeDocument, writeCreativeDocument } from '@/server/creative-document';
import { jsonResponse, errorResponse } from '@/server/http';

export const runtime = 'nodejs';

export async function GET() {
  try {
    return jsonResponse(await readCreativeDocument());
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return jsonResponse(await writeCreativeDocument(body));
  } catch (error) {
    return errorResponse(error);
  }
}
