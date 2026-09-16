/** Editor controls read production DOM; they never produce creative paint. */
export type ProductionBounds = { left: number; top: number; width: number; height: number };
export type ProductionTarget = ProductionBounds & { id: string; element: HTMLElement };

export function createRenderGeneration() {
  let generation = 0;
  return { next: () => ++generation, isCurrent: (value: number) => value === generation };
}

export function productionTargetId(id: string, child?: string) {
  if (id === 'TC_Solo' && child === 'terms-solo') return 'terms-solo';
  const target = /^offer\d+$/.test(id) ? id.replace(/^offer/, 'offer-slot-') : id;
  return child && target.startsWith('offer-slot-') ? `${target}::${child}` : target;
}

export function seekProductionAnimations(doc: Document, percent: number, durationSeconds: number) {
  const milliseconds = Math.max(0, Math.min(100, percent)) * durationSeconds * 10;
  for (const animation of doc.getAnimations()) {
    animation.pause();
    animation.currentTime = milliseconds;
  }
}

export function unionProductionBounds(boxes: ProductionBounds[]): ProductionBounds | null {
  if (!boxes.length) return null;
  const left = Math.min(...boxes.map(box => box.left));
  const top = Math.min(...boxes.map(box => box.top));
  return { left, top, width: Math.max(...boxes.map(box => box.left + box.width)) - left,
    height: Math.max(...boxes.map(box => box.top + box.height)) - top };
}

export function readProductionTargets(stage: HTMLElement, layerIds: string[]): ProductionTarget[] {
  const targets: ProductionTarget[] = [];
  const win = stage.ownerDocument.defaultView;
  if (!win) return targets;
  const origin = stage.getBoundingClientRect();
  const record = (id: string, element: HTMLElement | null) => {
    if (!element) return;
    // Parent visibility and opacity matter: invisible wrappers must not steal hits.
    if (win.getComputedStyle(element).visibility === 'hidden') return;
    let node: HTMLElement | null = element;
    let opacity = 1;
    while (node) {
      const style = win.getComputedStyle(node);
      if (style.display === 'none') return;
      opacity *= Number(style.opacity);
      if (node === stage) break;
      node = node.parentElement;
    }
    if (opacity <= 0.03) return;
    const rect = element.getBoundingClientRect();
    if (!(rect.width > 0 && rect.height > 0)) return;
    targets.push({id, element, left:rect.left-origin.left, top:rect.top-origin.top, width:rect.width, height:rect.height});
  };
  for (const id of layerIds) {
    const domId = id.replace(/^offer-slot-(\d+)$/, 'offer$1');
    const element = (id === 'terms-solo' ? stage.querySelector('#TC_Solo [data-dco-field="tc_terms_text"], .terms-solo') : stage.ownerDocument.getElementById(domId)) as HTMLElement | null;
    record(id, element);
    if (id.startsWith('offer-slot-') && element) {
      for (const child of ['offer-value', 'offer-subline']) record(`${id}::${child}`, element.querySelector(`.${child}`));
    }
  }
  return targets;
}

export type ProductionStageSource = { document: object; row: object };
let currentStage: HTMLElement | null = null;
let currentSource: ProductionStageSource | undefined;
let pendingSize = '';
let stageError: Error | null = null;
export function beginProductionStage(size: string) { pendingSize = size; currentStage = null; currentSource = undefined; stageError = null; }
export function publishProductionStage(stage: HTMLElement, source?: ProductionStageSource) { currentStage = stage; currentSource = source; stageError = null; }
export function failProductionStage(error: Error) { currentStage = null; currentSource = undefined; stageError = error; }
export function getProductionStage() { return currentStage; }
export async function waitForProductionStage(size: string, timeoutMs = 20000, renderMode?: 'font' | 'outline', expectedSource?: ProductionStageSource): Promise<HTMLElement> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (pendingSize === size && stageError) throw stageError;
    if (currentStage?.dataset.size === size && currentStage.isConnected && (!renderMode || currentStage.dataset.previewRenderMode === renderMode)
      && (!expectedSource || (currentSource?.document === expectedSource.document && currentSource?.row === expectedSource.row))) return currentStage;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error(`Production preview for ${size} did not become ready`);
}

export async function waitForProductionDocument(doc: Document, timeoutMs = 20000): Promise<HTMLElement> {
  const started = Date.now();
  // The production runtime releases .motion-ready only after fit and offer layout.
  while (Date.now() - started < timeoutMs) {
    const settled = (doc.defaultView as (Window & { __SSE_DCO_SETTLED__?: Promise<void> }) | null)?.__SSE_DCO_SETTLED__;
    if (settled) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([settled, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Production fitting did not settle')), Math.max(1, timeoutMs - (Date.now() - started))); })]);
      } finally { if (timer) clearTimeout(timer); }
      if (settled !== (doc.defaultView as any)?.__SSE_DCO_SETTLED__) continue;
    }
    const stage = doc.querySelector<HTMLElement>('.stage.motion-ready');
    const fontsReady = !doc.fonts || doc.fonts.status === 'loaded';
    const images = Array.from(doc.images);
    const imageError = images.find(img => img.complete && String(img.getAttribute('src') || '').trim() && img.naturalWidth === 0);
    if (imageError) throw new Error(`Creative image failed to load: ${imageError.getAttribute('src')}`);
    if (stage && fontsReady && images.every(img => img.complete)) {
      const failedFonts = doc.fonts ? Array.from(doc.fonts).filter(font => font.status === 'error') : [];
      if (failedFonts.length) throw new Error('Creative font failed to load');
      return stage;
    }
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error('Production creative did not finish loading fonts, images and runtime');
}

/** Snapshot fitted layout, excluding timeline transforms, then restore the exact pose. */
export function withProductionRestPose<T>(stage: HTMLElement, capture: () => T): T {
  const doc = stage.ownerDocument;
  const times = doc.getAnimations().map(animation => ({
    target: (animation.effect as KeyframeEffect | null)?.target,
    name: (animation as CSSAnimation).animationName,
    currentTime: animation.currentTime,
    playState: animation.playState,
  }));
  const hiddenStyle = doc.querySelector<HTMLStyleElement>('style[data-editor-hidden-layers]');
  const hiddenRules = hiddenStyle?.textContent || '';
  if (hiddenStyle) hiddenStyle.textContent = '';
  const style = doc.createElement('style');
  style.textContent = '.stage, .stage *, .stage *::before, .stage *::after { animation: none !important; }';
  doc.head.append(style);
  try {
    stage.getBoundingClientRect();
    return capture();
  } finally {
    style.remove();
    if (hiddenStyle) hiddenStyle.textContent = hiddenRules;
    for (const animation of doc.getAnimations()) {
      const previous = times.find(item => item.target === (animation.effect as KeyframeEffect | null)?.target
        && item.name === (animation as CSSAnimation).animationName);
      if (!previous) continue;
      animation.currentTime = previous.currentTime;
      if (previous.playState === 'paused') animation.pause();
    }
  }
}

export function resolveProductionHit(targets: ProductionTarget[], elements: Element[], x: number, y: number): string | null {
  const hitTargets = targets.filter(item => x >= item.left && x <= item.left + item.width
    && y >= item.top && y <= item.top + item.height);
  for (const element of elements) {
    const target = hitTargets.find(item => item.element === element || item.element.contains(element));
    if (target) {
      const nested = hitTargets.find(item => item.id.includes('::') && (item.element === element || item.element.contains(element)));
      return nested?.id || target.id;
    }
  }
  return null;
}

export function productionTargetClipped(flags: Map<string, boolean> | undefined, targetId: string, cssClass: string): boolean {
  return Boolean(flags?.get(targetId) ?? flags?.get(cssClass));
}
