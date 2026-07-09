import { NextResponse } from 'next/server';

import { readCreativeDocument } from '@/server/creative-document';
import { buildBasePackageZip } from '@/server/creative-exporter';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    let document = null;
    let assetMode: 'packaged' | 'cdn' = 'packaged';
    try {
      const body = await request.json();
      document = body?.document || null;
      assetMode = body?.assetMode === 'cdn' ? 'cdn' : 'packaged';
    } catch {
      document = null;
    }
    const zip = await buildBasePackageZip(document || await readCreativeDocument(), { assetMode });
    const filename = assetMode === 'cdn'
      ? 'SSE_DCO_base_cdn_zip.zip'
      : 'SSE_DCO_base_zip.zip';
    return new NextResponse(zip, {
      headers: {
        'content-type': 'application/zip',
        'content-disposition': `attachment; filename="${filename}"`,
        'content-length': String(zip.length),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to export base ZIP' },
      { status: 500 },
    );
  }
}
