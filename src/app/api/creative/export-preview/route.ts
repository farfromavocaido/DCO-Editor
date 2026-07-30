import { NextResponse } from 'next/server';

import { DEFAULT_CAMPAIGN_ID, listStaticPreviewCampaigns } from '@/server/campaign-registry';
import { readCreativeDocumentForCampaign } from '@/server/creative-document';
import {
  buildExportPreviewPackage,
  type ExportPreviewCampaignInput,
} from '@/server/creative-exporter';

export const runtime = 'nodejs';

type CampaignBody = {
  id?: string;
  document?: Record<string, unknown>;
  presentationSnapshots?: Record<string, unknown>;
};

export async function POST(request: Request) {
  try {
    let body: { campaigns?: CampaignBody[]; dcoDocument?: Record<string, unknown> } = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const allowed = new Map(listStaticPreviewCampaigns().map((entry) => [entry.id, entry]));
    const requested = Array.isArray(body.campaigns) ? body.campaigns : [];
    if (!requested.length) {
      return NextResponse.json(
        { error: 'Sync Zips requires campaigns: [{ id, presentationSnapshots? }]' },
        { status: 400 },
      );
    }

    const inputs: ExportPreviewCampaignInput[] = [];
    for (const entry of requested) {
      const id = String(entry?.id || '');
      if (!allowed.has(id)) {
        return NextResponse.json(
          { error: `Campaign ${id || '(missing)'} is not a statics preview campaign` },
          { status: 400 },
        );
      }
      const document = entry.document || await readCreativeDocumentForCampaign(id);
      inputs.push({
        id,
        document,
        ...(entry.presentationSnapshots
          ? { presentationSnapshots: entry.presentationSnapshots as ExportPreviewCampaignInput['presentationSnapshots'] }
          : {}),
      });
    }

    // DCO is always baked as Canonical Agency Zip into outputs/ (Pages download).
    const dcoDocument = body.dcoDocument || await readCreativeDocumentForCampaign(DEFAULT_CAMPAIGN_ID);
    const result = await buildExportPreviewPackage(inputs, { dcoDocument });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync preview zips' },
      { status: 500 },
    );
  }
}
