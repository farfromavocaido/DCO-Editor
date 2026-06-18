import { NextResponse } from 'next/server';

import { readCreativeDocument } from '@/server/creative-document';
import { buildClientPreviewZip } from '@/server/creative-exporter';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    let document = null;
    let includeValidator = true;
    try {
      const body = await request.json();
      document = body?.document || null;
      includeValidator = body?.includeValidator !== false;
    } catch {
      document = null;
    }
    const zip = await buildClientPreviewZip(document || await readCreativeDocument(), { includeValidator });
    const filename = includeValidator
      ? 'SSE_DCO_client_preview_package_validated.zip'
      : 'SSE_DCO_client_preview_package.zip';
    return new NextResponse(zip, {
      headers: {
        'content-type': 'application/zip',
        'content-disposition': `attachment; filename="${filename}"`,
        'content-length': String(zip.length),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to export client preview package' },
      { status: 500 },
    );
  }
}
