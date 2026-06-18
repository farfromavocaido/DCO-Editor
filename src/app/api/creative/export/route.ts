import { NextResponse } from 'next/server';

import { readCreativeDocument } from '@/server/creative-document';
import { buildAllCreativeHtmlFiles } from '@/server/creative-exporter';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const document = await readCreativeDocument();
    const result = await buildAllCreativeHtmlFiles(document);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to export creative HTML' },
      { status: 500 },
    );
  }
}
