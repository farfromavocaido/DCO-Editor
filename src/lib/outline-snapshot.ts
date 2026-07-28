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
 * Read fitted text + layout positions from a live preview/export stage.
 * Call after `applyPreviewTextFitting` (fit → symbol align → layoutOffers).
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
    const text = (element.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text && !element.classList.contains('offer-value') && !element.classList.contains('offer-subline')) {
      return;
    }
    texts[key] = {
      key,
      text,
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
      texts[key] = {
        key,
        text: (value.textContent || '').replace(/\s+/g, ' ').trim(),
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
      texts[key] = {
        key,
        text: (sub.textContent || '').replace(/\s+/g, ' ').trim(),
        fontSize,
        letterSpacingEm: letterSpacingToEm(style.letterSpacing, fontSize),
        alignOffsetY: parseTranslateY(sub.style.transform || style.transform || ''),
      };
    }
  });

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
      if (!key || positions[key]) return;
      // Prefer inline layout writes from layoutOffers; fall back to computed.
      const left = element.style.left
        ? cssNumber(element.style.left, NaN)
        : cssNumber(window.getComputedStyle(element).left, NaN);
      const top = element.style.top
        ? cssNumber(element.style.top, NaN)
        : cssNumber(window.getComputedStyle(element).top, NaN);
      if (!Number.isFinite(left) && !Number.isFinite(top)) return;
      // Only record when layoutOffers (or fit) wrote an inline position.
      if (!element.style.left && !element.style.top) return;
      positions[key] = {
        key,
        left: Number.isFinite(left) ? left : cssNumber(window.getComputedStyle(element).left, 0),
        top: Number.isFinite(top) ? top : cssNumber(window.getComputedStyle(element).top, 0),
      };
      // Alias offerN ↔ offer-slot-N for exporter lookups.
      if (key.startsWith('offer') && !key.startsWith('offer-slot-') && !key.includes('-')) {
        const alias = key.replace(/^offer/, 'offer-slot-');
        positions[alias] = { ...positions[key], key: alias };
      }
    });
  });

  return { size, texts, positions };
};
