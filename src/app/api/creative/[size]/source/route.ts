import { highlightHtmlSource } from '@/server/html-highlighter';
import { renderCreativeSourceHtml } from '@/server/render-creative-preview';

export const runtime = 'nodejs';

type Params = { params: Promise<{ size: string }> };

async function readDocumentPayload(request: Request) {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return request.json();
  const form = await request.formData();
  const payload = form.get('payload');
  if (typeof payload !== 'string') return {};
  return JSON.parse(payload);
}

/** Production Studio export — no baked feed row; dynamic fields are referenced via data-dco-field. */
async function renderSource(size: string, request?: Request) {
  if (!request || request.method === 'GET') {
    return renderCreativeSourceHtml(size);
  }
  const payload = await readDocumentPayload(request);
  return renderCreativeSourceHtml(size, { document: payload.document });
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const { size } = await params;
    const html = await renderSource(size);
    const highlighted = await highlightHtmlSource(html);
    return Response.json({ size, ...highlighted });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to render creative HTML source' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { size } = await params;
    const html = await renderSource(size, request);
    const highlighted = await highlightHtmlSource(html);
    return Response.json({ size, ...highlighted });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to render creative HTML source' },
      { status: 500 },
    );
  }
}
