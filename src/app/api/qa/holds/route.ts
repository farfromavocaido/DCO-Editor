import { holdSamplesForSize, type HoldSample } from '@/lib/hold-samples';
import {
  activeScopesFromControls,
  controlsFromFeedRow,
} from '@/lib/feed-model';
import { readCreativeDocumentForCampaign } from '@/server/creative-document';
import { QA_DCO_CAMPAIGN_ID } from '@/server/qa-agency-shell';
import { errorResponse, jsonResponse } from '@/server/http';

export const runtime = 'nodejs';

type HoldsBody = {
  row?: Record<string, unknown>;
  sizes?: string[];
  intervalMs?: number;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as HoldsBody;
    const row = body.row || {};
    const document = await readCreativeDocumentForCampaign(QA_DCO_CAMPAIGN_ID);
    const allSizes = Object.keys(document.sizes || {});
    const sizes = (body.sizes?.length ? body.sizes : allSizes)
      .filter((size) => allSizes.includes(size));
    const controls = controlsFromFeedRow(row);
    const scopes = activeScopesFromControls(controls);
    const intervalMs = body.intervalMs && body.intervalMs > 0 ? body.intervalMs : 250;

    const bySize: Record<string, { holdsMs: number[]; samples: HoldSample[]; scopes: string[] }> = {};
    for (const size of sizes) {
      const result = holdSamplesForSize(document, size, scopes, { row, intervalMs });
      bySize[size] = {
        holdsMs: result.holdsMs,
        samples: result.samples,
        scopes,
      };
    }

    return jsonResponse({
      scopes,
      controls,
      intervalMs,
      bySize,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
