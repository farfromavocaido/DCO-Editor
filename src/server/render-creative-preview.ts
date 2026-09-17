import {campaignFontFaces,campaignFontAssetUrl} from '@/lib/campaign-fonts';
import path from 'node:path';
import {assertCampaignStateValid} from '@/lib/campaign-variants';
import { CDN_FONT_URLS } from '@/lib/brand-font';
import { readCreativeDocumentForCampaign } from '@/server/creative-document';
import { renderStudioReadyHtml, renderWipHtml } from '@/server/creative-exporter';

const previewFonts=(document:any)=>document.fonts===undefined?CDN_FONT_URLS:Object.fromEntries(campaignFontFaces(document).map(face=>[path.basename(face.asset),campaignFontAssetUrl(face)]));

type PreviewOptions = {
  renderMode?: 'font' | 'outline';
  campaignId?: string;
  document?: Record<string, unknown>;
  row?: Record<string, unknown>;
  assetBasePath?: string;
};

export async function renderCreativeSourceHtml(size: string, options: PreviewOptions = {}) {
  const document = options.document || await readCreativeDocumentForCampaign(options.campaignId);
  return await renderStudioReadyHtml(document, size, {
    assetBasePath: options.assetBasePath ?? '/',
    // Same Studio CDN Museo the editor stage loads — fit + symbol metrics match serve.
    fontUrlMap: previewFonts(document),
  });
}

/** Standalone preview with the current feed row baked in for local QA only. */
export async function renderCreativePreviewHtml(size: string, options: PreviewOptions = {}) {
  const document = options.document || await readCreativeDocumentForCampaign(options.campaignId);
  const row = options.row ?? (document as Record<string, any>).feed?.sampleRows?.[0];
  assertCampaignStateValid(document,row || {});
  if (options.renderMode === 'outline') {
    const fixedDocument = { ...document, feed: { ...(document as Record<string, any>).feed, sampleRows: [{ ...(row || {}), Default: true }] } };
    return renderStudioReadyHtml(fixedDocument, size, { renderMode: 'outline', assetBasePath: options.assetBasePath ?? '/', fontUrlMap: previewFonts(document) });
  }
  const html = await renderCreativeSourceHtml(size, { ...options, document });
  if (!row) return html;
  return renderWipHtml(html, row);
}
