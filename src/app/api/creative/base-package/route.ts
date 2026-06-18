import { NextResponse } from 'next/server';

import { readCreativeDocument } from '@/server/creative-document';
import { buildBasePackageZip } from '@/server/creative-exporter';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    let document = null;
    try {
      const body = await request.json();
      document = body?.document || null;
    } catch {
      document = null;
    }
    const zip = await buildBasePackageZip(document || await readCreativeDocument());
    return new NextResponse(zip, {
      headers: {
        'content-type': 'application/zip',
        'content-disposition': 'attachment; filename="SSE_DCO_base_zip.zip"',
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
