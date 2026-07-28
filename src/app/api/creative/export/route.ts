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
      delivery?: string;
      document?: Record<string, unknown>;
      download?: boolean;
      presentationSnapshots?: Record<string, unknown>;
    } = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const campaignId = resolveCampaignId(request, body);
    const document = body.document || await readCreativeDocumentForCampaign(campaignId);
    const renderMode = body.renderMode === 'outline' ? 'outline' : 'font';
    const delivery = body.delivery === 'static' ? 'static' : 'studio';
    const download = body.download === true;
    const exportOptions = {
      renderMode,
      delivery: renderMode === 'outline' ? delivery : 'studio' as const,
      ...(renderMode === 'outline' && body.presentationSnapshots
        ? { presentationSnapshots: body.presentationSnapshots }
        : {}),
    };

    if (!download) {
      const result = await buildAllCreativeHtmlFiles(document, exportOptions);
      return NextResponse.json(result);
    }

    const { zip, slug } = await buildHtmlExportZip(document, exportOptions);
    const filename = renderMode === 'outline' && delivery === 'static'
      ? `${slug}_html_static.zip`
      : renderMode === 'outline'
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
