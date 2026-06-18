/** CSS class used for scaled offer-value unit symbols (% £ €). */
export const OFFER_VALUE_SYMBOL_CLASS = 'sym-pct';

const PREFIX_SYMBOLS = ['£', '€'] as const;

/** Wrap trailing % or leading £/€ in offer values for smaller symbol styling. */
export const wrapOfferValueSymbolsHtml = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  if (trimmed.endsWith('%')) {
    return `${trimmed.slice(0, -1)}<span class="${OFFER_VALUE_SYMBOL_CLASS}">%</span>`;
  }
  const prefix = trimmed.charAt(0);
  if (PREFIX_SYMBOLS.includes(prefix as (typeof PREFIX_SYMBOLS)[number])) {
    return `<span class="${OFFER_VALUE_SYMBOL_CLASS}">${prefix}</span>${trimmed.slice(1)}`;
  }
  return trimmed;
};

/** Browser runtime used by exported Studio HTML. */
export const wrapOfferValueSymbolRuntime = `
        function wrapOfferValueSymbol(element) {
          if (!element) return;
          var text = (element.textContent || '').trim();
          if (!text) return;
          if (text.endsWith('%')) {
            element.innerHTML = text.slice(0, -1) + '<span class="sym-pct">%</span>';
            return;
          }
          var first = text.charAt(0);
          if (first === '\\u00A3' || first === '\\u20AC') {
            element.innerHTML = '<span class="sym-pct">' + first + '</span>' + text.slice(1);
          }
        }
`.trim();

/** Browser runtime used by exported Studio HTML. */
export const alignOfferValueSymbolsRuntime = `
        function alignOfferValueSymbols() {
          var ctx = document.createElement('canvas').getContext('2d');
          document.querySelectorAll('.offer-value .sym-pct').forEach(function(symbol) {
            var valueStyle = window.getComputedStyle(symbol.parentElement);
            var symbolStyle = window.getComputedStyle(symbol);
            ctx.font = valueStyle.fontWeight + ' ' + valueStyle.fontSize + ' ' + valueStyle.fontFamily;
            var digit = ctx.measureText('5');
            ctx.font = symbolStyle.fontWeight + ' ' + symbolStyle.fontSize + ' ' + symbolStyle.fontFamily;
            var glyph = ctx.measureText(symbol.textContent || '');
            if (digit.actualBoundingBoxDescent === undefined) return;
            symbol.style.top = (digit.actualBoundingBoxDescent - glyph.actualBoundingBoxDescent) + 'px';
          });
        }
`.trim();
