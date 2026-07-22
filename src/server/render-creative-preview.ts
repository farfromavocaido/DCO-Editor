import { CDN_FONT_URLS } from '@/lib/brand-font';
import { readCreativeDocument } from '@/server/creative-document';
import { renderStudioReadyHtml, renderWipHtml } from '@/server/creative-exporter';

type PreviewOptions = {
  document?: Record<string, unknown>;
  row?: Record<string, unknown>;
  assetBasePath?: string;
};

export async function renderCreativeSourceHtml(size: string, options: PreviewOptions = {}) {
  const document = options.document || await readCreativeDocument();
  return await renderStudioReadyHtml(document, size, {
    assetBasePath: options.assetBasePath ?? '/',
    // Same Studio CDN Museo the editor stage loads — fit + symbol metrics match serve.
    fontUrlMap: CDN_FONT_URLS,
  });
}

/** Standalone preview with the current feed row baked in for local QA only. */
export async function renderCreativePreviewHtml(size: string, options: PreviewOptions = {}) {
  const document = options.document || await readCreativeDocument();
  const html = await renderCreativeSourceHtml(size, options);
  const row = options.row ?? (document as Record<string, any>).feed?.sampleRows?.[0];
  if (!row) return html;
  return renderWipHtml(html, row);
}
