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

export async function GET(_request: Request, { params }: Params) {
  try {
    const { size } = await params;
    const html = await renderCreativePreviewHtml(size);
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
    const html = await renderCreativePreviewHtml(size, {
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
