// @ts-nocheck
'use client';

import { useEffect, useMemo } from 'react';

import { useEditorStore } from '@/store/editor-store';

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function HtmlCodeInspector() {
  const open = useEditorStore((s) => s.htmlInspectorOpen);
  const loading = useEditorStore((s) => s.htmlInspectorLoading);
  const payload = useEditorStore((s) => s.htmlInspectorPayload);
  const closeHtmlInspector = useEditorStore((s) => s.closeHtmlInspector);
  const refreshHtmlInspector = useEditorStore((s) => s.refreshHtmlInspector);
  const copyHtmlInspector = useEditorStore((s) => s.copyHtmlInspector);
  const viewHtml = useEditorStore((s) => s.viewHtml);
  const setStatus = useEditorStore((s) => s.setStatus);

  const lineNumbers = useMemo(() => {
    if (!payload?.html) return '';
    return payload.html.split('\n').map((_, index) => String(index + 1)).join('\n');
  }, [payload?.html]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeHtmlInspector();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeHtmlInspector, open]);

  if (!open) return null;

  return (
    <div className="html-inspector-backdrop" role="presentation" onClick={closeHtmlInspector}>
      <section
        className="html-inspector"
        role="dialog"
        aria-modal="true"
        aria-labelledby="html-inspector-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="html-inspector-head">
          <div>
            <span className="panel-kicker">Production HTML · fields referenced via data-dco-field</span>
            <h2 id="html-inspector-title">
              {payload?.size || 'Creative'}
              {payload?.lineCount ? ` · ${payload.lineCount.toLocaleString()} lines` : ''}
              {payload?.byteLength ? ` · ${formatBytes(payload.byteLength)}` : ''}
            </h2>
          </div>
          <div className="html-inspector-actions">
            <button
              type="button"
              className="secondary"
              disabled={loading || !payload?.html}
              onClick={() => copyHtmlInspector().catch((error) => setStatus(error.message, 'error'))}
            >
              Copy
            </button>
            <button
              type="button"
              className="secondary"
              disabled={loading}
              onClick={() => refreshHtmlInspector().catch((error) => setStatus(error.message, 'error'))}
            >
              Refresh
            </button>
            <button type="button" className="secondary" onClick={viewHtml}>Open preview</button>
            <button type="button" className="icon-button" aria-label="Close HTML inspector" onClick={closeHtmlInspector}>×</button>
          </div>
        </header>

        <div className="html-inspector-body">
          {loading ? (
            <div className="html-inspector-loading">Formatting and highlighting HTML…</div>
          ) : (
            <div className="html-inspector-code">
              <pre className="html-inspector-gutter" aria-hidden="true">{lineNumbers}</pre>
              <div
                className="html-inspector-highlight shiki github-dark"
                dangerouslySetInnerHTML={{ __html: payload?.highlightedHtml || '' }}
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
