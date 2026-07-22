import { NextResponse } from 'next/server';

import { resolveCampaignId } from '@/server/campaign-query';
import { readCreativeDocumentForCampaign } from '@/server/creative-document';
import {
  buildBasePackageZip,
  exportSlugForDocument,
  type PackageAssetMode,
} from '@/server/creative-exporter';

export const runtime = 'nodejs';

const parseAssetMode = (value: unknown): PackageAssetMode => {
  if (value === 'cdn' || value === 'embed') return value;
  return 'packaged';
};

const filenameForBasePackage = (
  slug: string,
  assetMode: PackageAssetMode,
  renderMode: 'font' | 'outline',
) => {
  if (assetMode === 'cdn') return `${slug}_base_cdn_zip.zip`;
  if (assetMode === 'embed') return `${slug}_canonical_zip.zip`;
  return `${slug}_base_zip${renderMode === 'outline' ? '_outlines' : ''}.zip`;
};

export async function POST(request: Request) {
  try {
    let document = null;
    let assetMode: PackageAssetMode = 'packaged';
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
      assetMode = parseAssetMode(body?.assetMode);
      renderMode = body?.renderMode === 'outline' ? 'outline' : 'font';
    } catch {
      document = null;
    }
    const campaignId = resolveCampaignId(request, body);
    const creative = document || await readCreativeDocumentForCampaign(campaignId);
    const zip = await buildBasePackageZip(creative, { assetMode, renderMode });
    const slug = exportSlugForDocument(creative);
    const filename = filenameForBasePackage(slug, assetMode, renderMode);
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
