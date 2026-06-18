import { readCreativeDocument } from '@/server/creative-document';
import { buildCreativeHtmlFiles } from '@/server/creative-exporter';
import { jsonResponse, errorResponse } from '@/server/http';

export const runtime = 'nodejs';

type Params = { params: Promise<{ size: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { size } = await params;
    const document = await readCreativeDocument();
    return jsonResponse(await buildCreativeHtmlFiles(document, size));
  } catch (error) {
    return errorResponse(error);
  }
}
