import { NextResponse } from 'next/server';

import { resolveCampaignId } from '@/server/campaign-query';
import { readCreativeDocumentForCampaign } from '@/server/creative-document';
import { buildClientPreviewZip, exportSlugForDocument } from '@/server/creative-exporter';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    let document = null;
    let includeValidator = true;
    let renderMode: 'font' | 'outline' = 'font';
    let body: {
      document?: Record<string, unknown>;
      includeValidator?: boolean;
      renderMode?: string;
      campaign?: string;
    } = {};
    try {
      body = await request.json();
      document = body?.document || null;
      includeValidator = body?.includeValidator !== false;
      renderMode = body?.renderMode === 'outline' ? 'outline' : 'font';
    } catch {
      document = null;
    }
    const campaignId = resolveCampaignId(request, body);
    const creative = document || await readCreativeDocumentForCampaign(campaignId);
    const zip = await buildClientPreviewZip(creative, { includeValidator, renderMode });
    const slug = exportSlugForDocument(creative);
    const suffix = renderMode === 'outline' ? '_outlines' : '';
    const filename = includeValidator && renderMode === 'font'
      ? `${slug}_client_preview_package_validated.zip`
      : `${slug}_client_preview_package${suffix}.zip`;
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
