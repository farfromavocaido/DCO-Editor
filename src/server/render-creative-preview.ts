import { readCreativeDocument } from '@/server/creative-document';
import { renderStudioReadyHtml, renderWipHtml } from '@/server/creative-exporter';

type PreviewOptions = {
  document?: Record<string, unknown>;
  row?: Record<string, unknown>;
  assetBasePath?: string;
};

export async function renderCreativeSourceHtml(size: string, options: PreviewOptions = {}) {
  const document = options.document || await readCreativeDocument();
  return renderStudioReadyHtml(document, size, {
    assetBasePath: options.assetBasePath ?? '/',
    // Load the packaged Museo via the /assets proxy so in-editor previews
    // measure the same font Studio serves.
    fontBasePath: '/assets/fonts/',
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
