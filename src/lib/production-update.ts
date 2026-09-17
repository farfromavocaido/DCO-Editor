/** Reuse a loaded production document only when its structure and executable runtime match.
 * CSS and fitting rules still come directly from the exporter; feed binding stays in its runtime.
 */
export type ProductionUpdate = { signature: string; css: string[]; fitRules: unknown[]; layoutRules?: unknown[] };
export function describeProductionUpdate(html: string, parser: DOMParser): ProductionUpdate | null {
  const doc = parser.parseFromString(html, 'text/html');
  const config = doc.getElementById('sse-production-fit-rules');
  if (!config) return null; // Outlines and older runtimes use full document replacement.
  const fitRules = JSON.parse(config.textContent || '[]');
  if (!Array.isArray(fitRules)) return null;
  config.remove();
  const layout=doc.getElementById('dco-layout-rules');
  const layoutRules=layout?JSON.parse(layout.textContent||'[]'):[];layout?.remove();
  doc.getElementById('sse-dco-preview-feed')?.remove();
  const styles = Array.from(doc.querySelectorAll('style'));
  const css = styles.map(style => style.textContent || '');
  styles.forEach(style => { style.textContent = ''; });
  const stage = doc.querySelector('.stage');
  // State classes are determined by the actual runtime row, not the baked sample.
  stage?.setAttribute('class', 'stage page-content');
  return { signature: doc.documentElement.outerHTML, css, fitRules, layoutRules };
}
export function applyProductionUpdate(doc: Document, previous: ProductionUpdate | null, next: ProductionUpdate | null, row: Record<string, unknown>): boolean {
  const runtime = doc.defaultView as (Window & {
    updateSseDcoLayoutRules?: (rules: unknown[]) => void;
    updateSseDcoFitRules?: (rules: unknown[]) => void;
    applySseDcoRuntimeState?: (row: Record<string, unknown>) => void;
  }) | null;
  if (!previous || !next || previous.signature !== next.signature || !runtime?.updateSseDcoFitRules || !runtime.applySseDcoRuntimeState) return false;
  const styles = Array.from(doc.querySelectorAll<HTMLStyleElement>('style[data-production-style]'));
  if (styles.length !== next.css.length) return false;
  styles.forEach((style, index) => { if (style.textContent !== next.css[index]) style.textContent = next.css[index]; });
  runtime.updateSseDcoFitRules(next.fitRules);
  runtime.updateSseDcoLayoutRules?.(next.layoutRules || []);
  runtime.applySseDcoRuntimeState(row);
  return true;
}
