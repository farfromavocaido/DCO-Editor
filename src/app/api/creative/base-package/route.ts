import { NextResponse } from 'next/server';

import { resolveCampaignId } from '@/server/campaign-query';
import { readCreativeDocumentForCampaign } from '@/server/creative-document';
import { buildBasePackageZip, exportSlugForDocument } from '@/server/creative-exporter';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    let document = null;
    let assetMode: 'packaged' | 'cdn' = 'packaged';
    let renderMode: 'font' | 'outline' = 'font';
    let body: {
      document?: Record<string, unknown>;
      assetMode?: string;
      renderMode?: string;
      campaign?: string;
    } = {};
    try {
      body = await request.json();
      document = body?.document || null;
      assetMode = body?.assetMode === 'cdn' ? 'cdn' : 'packaged';
      renderMode = body?.renderMode === 'outline' ? 'outline' : 'font';
    } catch {
      document = null;
    }
    const campaignId = resolveCampaignId(request, body);
    const creative = document || await readCreativeDocumentForCampaign(campaignId);
    const zip = await buildBasePackageZip(creative, { assetMode, renderMode });
    const slug = exportSlugForDocument(creative);
    const filename = assetMode === 'cdn'
      ? `${slug}_base_cdn_zip.zip`
      : `${slug}_base_zip${renderMode === 'outline' ? '_outlines' : ''}.zip`;
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
