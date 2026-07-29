/**
 * Editor presentation snapshot for outline / static export.
 *
 * Static export is an Adobe Animate-style bake: capture what the preview stage
 * already resolved (fit size, tracking, symbol nudge, plus/slot positions) and
 * pass those numbers into the SVG outliner. No second fit engine at serve time.
 */

export type TextPresentationSnapshot = {
  /** Layer id, nested id (`offer-slot-1::offer-value`), or DOM id. */
  key: string;
  text: string;
  /**
   * Exact lines the editor painted (hard breaks + soft wraps). Outline bake
   * must use these — recomputing soft-wrap with opentype widths diverges from
   * browser Museo (e.g. wrap/maxLines:2 knocking "OFF ELECTRICITY*" to 2 lines).
   */
  lines?: string[];
  fontSize: number;
  /** Final letter-spacing in em of the host font-size (0 when normal). */
  letterSpacingEm: number;
  /** text-fit `align: 'bottom'` translateY in px. */
  alignOffsetY: number;
  /** Offer values with `%` / `£` / `€` — bake at 0.6em + ink-bottom align. */
  scaleOfferSymbols?: boolean;
};

export type PositionSnapshot = {
  key: string;
  left: number;
  top: number;
  width?: number;
  height?: number;
  /**
   * Live text-run box relative to the host (offer-value-run / Range line).
   * Used when ink rect is unavailable.
   */
  contentLeft?: number;
  contentTop?: number;
  contentWidth?: number;
  contentHeight?: number;
  /**
   * Painted glyph ink relative to the host (Animate bake anchor).
   * Outline places the SVG at inkLeft/inkTop and maps path bbox → (0,0).
   */
  inkLeft?: number;
  inkTop?: number;
  inkRight?: number;
  inkBottom?: number;
};

export type SizePresentationSnapshot = {
  size: string;
  texts: Record<string, TextPresentationSnapshot>;
  positions: Record<string, PositionSnapshot>;
};

export type PresentationSnapshots = Record<string, SizePresentationSnapshot>;

const cssNumber = (value: string | null | undefined, fallback = 0) => {
  const numeric = Number.parseFloat(String(value || ''));
  return Number.isFinite(numeric) ? numeric : fallback;
};

/** Convert computed `letter-spacing` to em relative to `fontSizePx`. */
export const letterSpacingToEm = (letterSpacing: string, fontSizePx: number) => {
  const raw = String(letterSpacing || '').trim().toLowerCase();
  if (!raw || raw === 'normal') return 0;
  if (raw.endsWith('em')) return cssNumber(raw, 0);
  if (!Number.isFinite(fontSizePx) || fontSizePx <= 0) return 0;
  // px, or unitless lengths from getComputedStyle (always px in browsers)
  return cssNumber(raw, 0) / fontSizePx;
};

/** Authored creative JSON letterSpacing → em (unitless / px → px÷fontSize). */
export const authoredLetterSpacingToEm = (value: unknown, fontSizePx: number) => {
  if (value === undefined || value === null || value === '' || value === 'normal') return 0;
  if (typeof value === 'string') {
    const raw = value.trim().toLowerCase();
    if (raw.endsWith('em')) return cssNumber(raw, 0);
    if (raw.endsWith('px')) {
      return fontSizePx > 0 ? cssNumber(raw, 0) / fontSizePx : 0;
    }
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || fontSizePx <= 0) return 0;
  // Creative JSON stores unitless lengths like other box fields → px.
  return numeric / fontSizePx;
};

const parseTranslateY = (transform: string) => {
  const match = String(transform || '').match(/translateY\(\s*([-\d.]+)px\s*\)/i)
    || String(transform || '').match(/translate\(\s*([-\d.]+)px\s*,\s*([-\d.]+)px\s*\)/i);
  if (!match) return 0;
  return cssNumber(match[2] !== undefined ? match[2] : match[1], 0);
};

const emptyLocalRect = () => ({
  left: 0,
  top: 0,
  width: 0,
  height: 0,
  right: 0,
  bottom: 0,
});

/** Map a client rect into ancestor-local CSS px (corrects editor stage scale()). */
const clientToLocal = (rect: DOMRect | null | undefined, ancestor: HTMLElement) => {
  if (!rect || !ancestor) return emptyLocalRect();
  const ar = ancestor.getBoundingClientRect();
  const sx = ar.width > 0 ? ancestor.offsetWidth / ar.width : 1;
  const sy = ar.height > 0 ? ancestor.offsetHeight / ar.height : 1;
  const left = (rect.left - ar.left) * sx;
  const top = (rect.top - ar.top) * sy;
  const width = rect.width * sx;
  const height = rect.height * sy;
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  };
};

const rangeLocalRect = (element: HTMLElement, ancestor: HTMLElement) => {
  const doc = element.ownerDocument;
  if (!doc?.createRange) return clientToLocal(element.getBoundingClientRect(), ancestor);
  const range = doc.createRange();
  try {
    range.selectNodeContents(element);
    const rect = range.getBoundingClientRect();
    if (rect && (rect.width > 0 || rect.height > 0)) {
      return clientToLocal(rect, ancestor);
    }
  } finally {
    range.detach?.();
  }
  return clientToLocal(element.getBoundingClientRect(), ancestor);
};

/**
 * Paint box in host space for Animate bake.
 * Uses the laid-out run/Range box only — not canvas fontBoundingBox ink.
 * Canvas ink tops were systematically low on tight 320x50 line boxes and shoved
 * outlined values into sublines after ink-anchor placement.
 */
const paintBoxLocal = (element: HTMLElement, host: HTMLElement, preferDigits: boolean) => {
  if (preferDigits) {
    return clientToLocal(element.getBoundingClientRect(), host);
  }
  return rangeLocalRect(element, host);
};

/**
 * Collapse horizontal whitespace but keep authored `\n` (CSS `pre-line` parity)
 * so outline bake can hard-break the same way as the live font preview.
 */
export const normalizeCapturedText = (value: string | null | undefined) => (
  String(value || '')
    .replace(/\r\n|\r/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .trim()
);

const normalizeLineText = (value: string) => value.replace(/\s+/g, ' ').trim();

/**
 * Read the lines the browser actually painted (soft wraps included).
 * Character tops via Range — same breaks the preview shows, not opentype wrap.
 *
 * IMPORTANT: do not soft-split offer values. `.sym-pct` (0.6em + ink nudge) sits
 * on a different rect.top than the digits; treating that as a line break baked
 * "15" and "%" onto separate SVG lines (symbol under the subline).
 */
export const captureDisplayedLines = (element: HTMLElement | null | undefined): string[] => {
  const fallback = normalizeCapturedText(element?.textContent);
  if (!fallback || !element) return fallback ? fallback.split('\n') : [];
  const hardOnly = fallback.split('\n').filter((line) => line.length > 0);

  // nowrap / offer-value / scaled currency symbols → hard breaks only.
  try {
    const style = typeof window !== 'undefined' ? window.getComputedStyle(element) : null;
    const nowrap = Boolean(style && /nowrap/i.test(style.whiteSpace || ''));
    const offerValue = element.classList?.contains('offer-value')
      || Boolean(element.querySelector?.('.sym-pct, .offer-value-run'));
    if (nowrap || offerValue) return hardOnly.length ? hardOnly : [fallback.replace(/\n/g, ' ')];
  } catch {
    // Non-DOM test doubles — fall through to hard breaks when layout APIs missing.
  }

  const doc = element.ownerDocument;
  if (!doc?.createRange || !doc.createTreeWalker) {
    return hardOnly;
  }

  const textNodes: Text[] = [];
  const walker = doc.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node: Node | null = walker.nextNode();
  while (node) {
    if (node.textContent) textNodes.push(node as Text);
    node = walker.nextNode();
  }
  if (!textNodes.length) return hardOnly;

  type CharRef = { node: Text; offset: number; ch: string };
  const chars: CharRef[] = [];
  for (const textNode of textNodes) {
    const value = textNode.textContent || '';
    for (let offset = 0; offset < value.length; offset += 1) {
      chars.push({ node: textNode, offset, ch: value[offset] });
    }
  }
  if (!chars.length) return hardOnly;

  // Soft-wrap detection: require a top jump roughly ≥ half a line box so nested
  // inline (different font-size) cannot register as a new line.
  const fontSize = cssNumber(
    typeof window !== 'undefined' ? window.getComputedStyle(element).fontSize : '',
    12,
  );
  const minLineJump = Math.max(4, fontSize * 0.45);

  const range = doc.createRange();
  const lineStarts = [0];
  let lastTop: number | null = null;
  for (let index = 0; index < chars.length; index += 1) {
    const { node: textNode, offset, ch } = chars[index];
    if (ch === '\n' || ch === '\r') {
      if (lineStarts[lineStarts.length - 1] !== index + 1) lineStarts.push(index + 1);
      lastTop = null;
      continue;
    }
    try {
      range.setStart(textNode, offset);
      range.setEnd(textNode, offset + 1);
      const rect = range.getBoundingClientRect();
      if (!(rect.width > 0 || rect.height > 0)) continue;
      if (lastTop === null) {
        lastTop = rect.top;
        continue;
      }
      if (Math.abs(rect.top - lastTop) > minLineJump) {
        lineStarts.push(index);
        lastTop = rect.top;
      }
    } catch {
      // Detached / odd nodes — keep scanning.
    }
  }

  const raw = chars.map((item) => item.ch).join('');
  const lines: string[] = [];
  for (let i = 0; i < lineStarts.length; i += 1) {
    const start = lineStarts[i];
    const end = i + 1 < lineStarts.length ? lineStarts[i + 1] : raw.length;
    const line = normalizeLineText(raw.slice(start, end).replace(/\r?\n/g, ''));
    if (line) lines.push(line);
  }
  return lines.length ? lines : hardOnly;
};

const textKeyForElement = (element: Element) => {
  const id = element.getAttribute('id');
  if (id) return id;
  const slot = element.closest('[id^="offer"]');
  const slotId = slot?.getAttribute('id') || '';
  if (element.classList.contains('offer-value') && slotId) {
    return `${slotId.replace(/^offer/, 'offer-slot-')}::offer-value`;
  }
  if (element.classList.contains('offer-subline') && slotId) {
    return `${slotId.replace(/^offer/, 'offer-slot-')}::offer-subline`;
  }
  if (element.classList.contains('offer-value')) return 'offer-value';
  if (element.classList.contains('offer-subline')) return 'offer-subline';
  return '';
};

/**
 * Call after `applyPreviewTextFitting` (fit → symbol align → layoutOffers).
 * Captures text metrics plus live host boxes (slots, pluses, offer-value /
 * offer-subline) so outline/static export can bake WYSIWYG left/top — including
 * side-by-side subline ink lock that only exists as inline style in the editor.
 */
export const capturePresentationSnapshot = (
  stage: ParentNode | null | undefined,
  size: string,
): SizePresentationSnapshot => {
  const texts: Record<string, TextPresentationSnapshot> = {};
  const positions: Record<string, PositionSnapshot> = {};
  if (!stage || !('querySelectorAll' in stage)) {
    return { size, texts, positions };
  }

  const textNodes = stage.querySelectorAll(
    '.offer-value, .offer-subline, .sse-text, .cta, [data-layer-id], #cta, #roundel-value',
  );
  textNodes.forEach((node) => {
    const element = node as HTMLElement;
    if (element.closest('.offers-block-group') && element.classList.contains('offers-block-group')) {
      return;
    }
    const key = textKeyForElement(element);
    if (!key || texts[key]) return;
    const style = window.getComputedStyle(element);
    if (style.visibility === 'hidden') return;
    const fontSize = cssNumber(style.fontSize, 0);
    if (fontSize <= 0) return;
    const text = normalizeCapturedText(element.textContent);
    if (!text && !element.classList.contains('offer-value') && !element.classList.contains('offer-subline')) {
      return;
    }
    const lines = captureDisplayedLines(element);
    texts[key] = {
      key,
      text,
      ...(lines.length ? { lines } : {}),
      fontSize,
      letterSpacingEm: letterSpacingToEm(style.letterSpacing, fontSize),
      alignOffsetY: parseTranslateY(element.style.transform || style.transform || ''),
      scaleOfferSymbols: element.classList.contains('offer-value') || undefined,
    };
  });

  // Nested offer targets use offer-slot-N::… keys even when the DOM id is offerN.
  stage.querySelectorAll('[id^="offer-slot-"], [id^="offer"]').forEach((slot) => {
    const slotEl = slot as HTMLElement;
    const slotId = slotEl.id || '';
    if (!slotId) return;
    const normalizedSlot = slotId.startsWith('offer-slot-')
      ? slotId
      : slotId.replace(/^offer/, 'offer-slot-');
    const value = slotEl.querySelector('.offer-value') as HTMLElement | null;
    const sub = slotEl.querySelector('.offer-subline') as HTMLElement | null;
    if (value) {
      const key = `${normalizedSlot}::offer-value`;
      const style = window.getComputedStyle(value);
      const fontSize = cssNumber(style.fontSize, 0);
      const lines = captureDisplayedLines(value);
      texts[key] = {
        key,
        text: normalizeCapturedText(value.textContent),
        ...(lines.length ? { lines } : {}),
        fontSize,
        letterSpacingEm: letterSpacingToEm(style.letterSpacing, fontSize),
        alignOffsetY: parseTranslateY(value.style.transform || style.transform || ''),
        scaleOfferSymbols: true,
      };
    }
    if (sub) {
      const key = `${normalizedSlot}::offer-subline`;
      const style = window.getComputedStyle(sub);
      const fontSize = cssNumber(style.fontSize, 0);
      const lines = captureDisplayedLines(sub);
      texts[key] = {
        key,
        text: normalizeCapturedText(sub.textContent),
        ...(lines.length ? { lines } : {}),
        fontSize,
        letterSpacingEm: letterSpacingToEm(style.letterSpacing, fontSize),
        alignOffsetY: parseTranslateY(sub.style.transform || style.transform || ''),
      };
    }
  });

  const recordPosition = (element: HTMLElement, key: string) => {
    if (!key || positions[key]) return;
    const style = window.getComputedStyle(element);
    if (style.visibility === 'hidden') return;
    // Prefer inline layout writes (side-by-side / placePlus); else computed CSS box.
    const left = element.style.left
      ? cssNumber(element.style.left, NaN)
      : cssNumber(style.left, NaN);
    const top = element.style.top
      ? cssNumber(element.style.top, NaN)
      : cssNumber(style.top, NaN);
    if (!Number.isFinite(left) && !Number.isFinite(top)) return;
    const widthRaw = element.style.width || style.width;
    const heightRaw = element.style.height || style.height;
    const width = cssNumber(widthRaw, NaN);
    const height = cssNumber(heightRaw, NaN);
    positions[key] = {
      key,
      left: Number.isFinite(left) ? left : cssNumber(style.left, 0),
      top: Number.isFinite(top) ? top : cssNumber(style.top, 0),
      ...(Number.isFinite(width) && width >= 0 ? { width } : {}),
      ...(Number.isFinite(height) && height >= 0 ? { height } : {}),
    };
  };

  /** Content-run + paint box relative to the offer host (Animate-style bake). */
  const recordOfferTextGeometry = (
    host: HTMLElement,
    key: string,
    preferDigits: boolean,
  ) => {
    recordPosition(host, key);
    const pos = positions[key];
    if (!pos) return;
    const run = (preferDigits
      ? (host.querySelector('.offer-value-run') as HTMLElement | null)
      : null) || host;
    const box = paintBoxLocal(run, host, preferDigits);
    if (!box || !(box.width > 0 || box.height > 0)) return;
    // Layout box of the painted run/line — exact editor envelope.
    pos.contentLeft = Number(box.left.toFixed(2));
    pos.contentTop = Number(box.top.toFixed(2));
    pos.contentWidth = Number(Math.max(box.width, 1).toFixed(2));
    pos.contentHeight = Number(Math.max(box.height, 1).toFixed(2));
    // Ink anchor = same paint box (no canvas font-metric reinterpretation).
    pos.inkLeft = pos.contentLeft;
    pos.inkTop = pos.contentTop;
    pos.inkRight = Number(box.right.toFixed(2));
    pos.inkBottom = Number(box.bottom.toFixed(2));
  };

  const positionSelectors = [
    '#plus-1',
    '#plus-2',
    '[id^="offer-slot-"]',
    '[id^="offer"]',
  ];
  positionSelectors.forEach((selector) => {
    stage.querySelectorAll(selector).forEach((node) => {
      const element = node as HTMLElement;
      const key = element.id;
      if (!key) return;
      recordPosition(element, key);
      // Alias offerN ↔ offer-slot-N for exporter lookups.
      if (key.startsWith('offer') && !key.startsWith('offer-slot-') && !key.includes('-')) {
        const alias = key.replace(/^offer/, 'offer-slot-');
        if (positions[key] && !positions[alias]) {
          positions[alias] = { ...positions[key], key: alias };
        }
      }
    });
  });

  // Nested offer hosts: bake live left/top after side-by-side ink lock (fixed-copy WYSIWYG).
  stage.querySelectorAll('[id^="offer-slot-"], [id^="offer"]').forEach((slot) => {
    const slotEl = slot as HTMLElement;
    const slotId = slotEl.id || '';
    if (!slotId) return;
    const normalizedSlot = slotId.startsWith('offer-slot-')
      ? slotId
      : (/^offer\d+$/.test(slotId) ? slotId.replace(/^offer/, 'offer-slot-') : '');
    if (!normalizedSlot) return;
    const value = slotEl.querySelector('.offer-value') as HTMLElement | null;
    const sub = slotEl.querySelector('.offer-subline') as HTMLElement | null;
    if (value) recordOfferTextGeometry(value, `${normalizedSlot}::offer-value`, true);
    if (sub) recordOfferTextGeometry(sub, `${normalizedSlot}::offer-subline`, false);
  });

  return { size, texts, positions };
};
