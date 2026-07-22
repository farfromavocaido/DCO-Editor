import { NextResponse } from 'next/server';

import { resolveCampaignId } from '@/server/campaign-query';
import { readCreativeDocumentForCampaign } from '@/server/creative-document';
import { buildAllCreativeHtmlFiles, buildHtmlExportZip } from '@/server/creative-exporter';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    let body: {
      campaign?: string;
      renderMode?: string;
      document?: Record<string, unknown>;
      download?: boolean;
    } = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const campaignId = resolveCampaignId(request, body);
    const document = body.document || await readCreativeDocumentForCampaign(campaignId);
    const renderMode = body.renderMode === 'outline' ? 'outline' : 'font';
    const download = body.download === true;

    if (!download) {
      const result = await buildAllCreativeHtmlFiles(document, { renderMode });
      return NextResponse.json(result);
    }

    const { zip, slug } = await buildHtmlExportZip(document, { renderMode });
    const filename = renderMode === 'outline'
      ? `${slug}_html_outlines.zip`
      : `${slug}_html.zip`;
    return new NextResponse(zip, {
      headers: {
        'content-type': 'application/zip',
        'content-disposition': `attachment; filename="${filename}"`,
        'content-length': String(zip.length),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to export creative HTML' },
      { status: 500 },
    );
  }
}
