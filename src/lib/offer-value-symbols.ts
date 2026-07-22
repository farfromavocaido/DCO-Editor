/** CSS class used for scaled offer-value unit symbols (% £ €). */
export const OFFER_VALUE_SYMBOL_CLASS = 'sym-pct';

/**
 * Inline wrapper around the whole value run (digits + symbol).
 * Keeps glyph pairing on a shared alphabetic baseline even when `.offer-value`
 * is a flex box with `align-items: flex-end` / centre — flex only pins this
 * one child; it must not split digit and symbol into separate flex items.
 */
export const OFFER_VALUE_RUN_CLASS = 'offer-value-run';

const PREFIX_SYMBOLS = ['£', '€'] as const;

const wrapInnerSymbols = (trimmed: string) => {
  if (trimmed.endsWith('%')) {
    return `${trimmed.slice(0, -1)}<span class="${OFFER_VALUE_SYMBOL_CLASS}">%</span>`;
  }
  const prefix = trimmed.charAt(0);
  if (PREFIX_SYMBOLS.includes(prefix as (typeof PREFIX_SYMBOLS)[number])) {
    return `<span class="${OFFER_VALUE_SYMBOL_CLASS}">${prefix}</span>${trimmed.slice(1)}`;
  }
  return trimmed;
};

/** Wrap offer values in an inline run; scale trailing % or leading £/€. */
export const wrapOfferValueSymbolsHtml = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  return `<span class="${OFFER_VALUE_RUN_CLASS}">${wrapInnerSymbols(trimmed)}</span>`;
};

/** Shared CSS so the run stays one flex child / one inline glyph stream. */
export const offerValueSymbolCss = `
    .offer-value .${OFFER_VALUE_RUN_CLASS} {
      white-space: nowrap;
    }
`.trim();

/** Browser runtime used by exported Studio HTML. */
export const wrapOfferValueSymbolRuntime = `
        function wrapOfferValueSymbol(element) {
          if (!element) return;
          var text = (element.textContent || '').trim();
          if (!text) return;
          var inner = text;
          if (text.endsWith('%')) {
            inner = text.slice(0, -1) + '<span class="sym-pct">%</span>';
          } else {
            var first = text.charAt(0);
            if (first === '\\u00A3' || first === '\\u20AC') {
              inner = '<span class="sym-pct">' + first + '</span>' + text.slice(1);
            }
          }
          element.innerHTML = '<span class="offer-value-run">' + inner + '</span>';
        }
`.trim();

// Align reduced symbols to the digit *ink* bottom (shared alphabetic baseline).
// Authored as ES5 so the editor evaluates the exact function exported ads inline.
//
// IMPORTANT: do NOT align getBoundingClientRect bottoms of the digit text node
// vs the symbol span — those are line/em boxes. On Museo the digit box hangs
// well below the glyph ink, so box-bottom matching drops %/£/€ too low.
//
// Digits + symbol live inside `.offer-value-run` so flex align on `.offer-value`
// cannot pull them onto different flex baselines.
const ALIGN_OFFER_VALUE_SYMBOLS_SOURCE = `(function createAlignOfferValueSymbols() {
  return function alignOfferValueSymbols(root) {
    var scope = root || document;
    if (!scope || !scope.querySelectorAll) return;
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    if (!ctx || ctx.measureText('5').actualBoundingBoxDescent === undefined) return;

    var symbols = scope.querySelectorAll('.offer-value .sym-pct');
    Array.prototype.forEach.call(symbols, function(symbol) {
      var run = symbol.parentElement;
      if (!run) return;
      var valueRoot = run.closest ? run.closest('.offer-value') : null;
      var measureHost = valueRoot || run;
      var valueStyle = window.getComputedStyle(measureHost);
      var symbolStyle = window.getComputedStyle(symbol);

      // Digits live as text in the run; measure a lining figure at value size.
      ctx.font = valueStyle.fontWeight + ' ' + valueStyle.fontSize + ' ' + valueStyle.fontFamily;
      var digit = ctx.measureText('5');
      ctx.font = symbolStyle.fontWeight + ' ' + symbolStyle.fontSize + ' ' + symbolStyle.fontFamily;
      var glyph = ctx.measureText(symbol.textContent || '');

      // With vertical-align:baseline inside the run, both share the alphabetic baseline.
      // Nudge so glyph ink bottom == digit ink bottom.
      var delta = digit.actualBoundingBoxDescent - glyph.actualBoundingBoxDescent;
      if (!isFinite(delta)) return;
      if (Math.abs(delta) < 0.25) {
        symbol.style.top = '';
        return;
      }
      symbol.style.top = delta + 'px';
    });
  };
})`;

/** Factory matching the inlined export runtime — editor and ads share one body. */
export const createAlignOfferValueSymbols = new Function(
  `"use strict"; return ${ALIGN_OFFER_VALUE_SYMBOLS_SOURCE};`,
)();

/** Editor-preview entry point; pass the stage root when available. */
export const alignOfferValueSymbols = (root?: ParentNode | Document | null) => {
  const scope = root || (typeof document !== 'undefined' ? document : null);
  if (!scope) return;
  createAlignOfferValueSymbols()(scope);
};

/** Inlined into exported Studio HTML (defines alignOfferValueSymbols). */
export const alignOfferValueSymbolsRuntime = `
        var alignOfferValueSymbols = ${ALIGN_OFFER_VALUE_SYMBOLS_SOURCE}();
`.trim();
