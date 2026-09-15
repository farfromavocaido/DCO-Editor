import { renderCreativePreviewHtml } from '@/server/render-creative-preview';

export const runtime = 'nodejs';

type Params = { params: Promise<{ size: string }> };

async function readPreviewPayload(request: Request) {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return request.json();
  const form = await request.formData();
  const payload = form.get('payload');
  if (typeof payload !== 'string') return {};
  return JSON.parse(payload);
}

function htmlResponse(html: string) {
  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { size } = await params;
    const html = await renderCreativePreviewHtml(size, { campaignId: new URL(request.url).searchParams.get('campaign') || undefined });
    return htmlResponse(html);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to render creative HTML preview' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { size } = await params;
    const payload = await readPreviewPayload(request);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)
      || (payload.document !== undefined && (!payload.document || typeof payload.document !== 'object' || Array.isArray(payload.document) || !payload.document.sizes))
      || (payload.row !== undefined && (!payload.row || typeof payload.row !== 'object' || Array.isArray(payload.row)))) {
      return Response.json({ error: 'Expected a creative document and feed row object' }, { status: 400 });
    }
    const html = await renderCreativePreviewHtml(size, {
      campaignId: new URL(request.url).searchParams.get('campaign') || undefined,
      document: payload.document,
      row: payload.row,
    });
    return htmlResponse(html);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to render creative HTML preview' },
      { status: 500 },
    );
  }
}
