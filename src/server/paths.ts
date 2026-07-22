import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_CAMPAIGN_ID, getCampaign } from './campaign-registry';

const serverDir = path.dirname(fileURLToPath(import.meta.url));

/** App root (repository root) */
export const appRoot = path.resolve(serverDir, '../..');

/** Campaign data: creative document, assets */
export const projectRoot = path.resolve(appRoot, 'campaign');

/** Generated HTML and export packages */
export const outputRoot = path.resolve(appRoot, 'output');

export const creativeDocumentPathFor = (campaignId: string | null | undefined = DEFAULT_CAMPAIGN_ID) => {
  const entry = getCampaign(campaignId);
  return path.resolve(projectRoot, entry.file);
};

/** Default campaign document path (SSE DCO). */
export const creativeDocumentPath = creativeDocumentPathFor(DEFAULT_CAMPAIGN_ID);
