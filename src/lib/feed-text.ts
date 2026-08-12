/**
 * Studio feed rows sometimes encode line breaks as HTML `<br>` tags.
 * Creative runtime uses textContent / multiline `\n`, so normalize on read.
 */
export const normalizeFeedLineBreaks = (value: unknown) => (
  String(value ?? '').replace(/<br\s*\/?>/gi, '\n')
);
