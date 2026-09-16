// @ts-nocheck
export const categories = [
  { name: 'Offer arrangement', domain: 'values', fields: { '--offer-layout-mode': 'Offer arrangement ownership' } },
  { name: 'Position', domain: 'values', fields: { left: 'Horizontal position', top: 'Vertical position' } },
  { name: 'Size', domain: 'values', fields: { width: 'Frame width', height: 'Frame height' } },
  { name: 'Colour', domain: 'values', fields: { color: 'Text colour', backgroundColor: 'Fill colour', borderColor: 'Border colour' } },
  { name: 'Typography', domain: 'values', fields: { fontFamily: 'Font family', fontSize: 'Font size', lineHeight: 'Line height', letterSpacing: 'Letter spacing', textAlign: 'Horizontal alignment', alignItems: 'Vertical alignment' } },
  { name: 'Text fitting', domain: 'fit', fields: { frame: 'Frame sizing', mode: 'Fitting mode', maxLines: 'Maximum lines', minFontSize: 'Minimum font size', minFontSizeRatio: 'Minimum size ratio', wrap: 'Allow wrapping', allowShrink: 'Allow shrinking', overflow: 'Overflow behaviour', shared: 'Equalise fitted size', tracking: 'Tracking adjustment' } },
];
export const labels = Object.assign({}, ...categories.map((category) => category.fields));
