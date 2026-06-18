// @ts-nocheck
const defaultGetComputedStyle = (element) => window.getComputedStyle(element);

const cssNumber = (value, fallback = 0) => {
  const numeric = Number.parseFloat(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const isOverflowing = (element) => {
  return element.clientWidth > 0 && element.scrollWidth > element.clientWidth;
};

const lineHeightPx = (computedStyle, fontSize) => {
  const parsed = cssNumber(computedStyle.lineHeight, 0);
  return parsed > 0 ? parsed : fontSize * 1.15;
};

const maxLineHeight = (element, rule, computedStyle, fontSize) => {
  const maxLines = Number(rule.maxLines);
  if (!Number.isFinite(maxLines) || maxLines <= 0) return null;
  return lineHeightPx(computedStyle, fontSize) * maxLines;
};

const maxTextHeight = (element, rule, computedStyle, fontSize) => {
  const maxHeight = maxLineHeight(element, rule, computedStyle, fontSize);
  if (maxHeight === null) return null;
  const lineHeight = lineHeightPx(computedStyle, fontSize);
  const boxHeight = Number(element.clientHeight) || 0;
  if (boxHeight <= maxHeight) return maxHeight;
  const browserLineBoxSlack = Math.max(2, lineHeight * 0.15);
  return Math.min(boxHeight, maxHeight + browserLineBoxSlack);
};

const textContentHeight = (element) => {
  const range = element.ownerDocument?.createRange?.();
  if (!range) return null;
  try {
    range.selectNodeContents(element);
    const rect = range.getBoundingClientRect();
    return rect?.height > 0 ? rect.height : null;
  } finally {
    range.detach?.();
  }
};

const resetFitStyles = (element) => {
  element.style.fontSize = '';
  element.style.whiteSpace = '';
  element.style.overflow = '';
  element.style.textOverflow = '';
  element.style.maxHeight = '';
};

const applyStaticFitMode = (element, rule, computedStyle) => {
  resetFitStyles(element);
  const mode = rule.mode || 'shrink';
  if (mode === 'wrap') {
    element.style.whiteSpace = 'normal';
    return cssNumber(computedStyle.fontSize, Number(rule.minFontSize) || 1);
  }
  if (mode === 'clip') {
    element.style.overflow = 'hidden';
    return cssNumber(computedStyle.fontSize, Number(rule.minFontSize) || 1);
  }
  if (mode === 'truncate') {
    element.style.whiteSpace = 'nowrap';
    element.style.overflow = 'hidden';
    element.style.textOverflow = 'ellipsis';
    return cssNumber(computedStyle.fontSize, Number(rule.minFontSize) || 1);
  }
  return null;
};

const isTooTall = (element, rule, computedStyle, fontSize) => {
  const maxHeight = maxTextHeight(element, rule, computedStyle, fontSize);
  if (maxHeight === null) return false;
  const measuredHeight = textContentHeight(element) ?? element.scrollHeight;
  return measuredHeight > maxHeight + 1;
};

const isVisible = (element, getComputedStyle) => {
  let node = element;
  while (node) {
    if (getComputedStyle(node).visibility === 'hidden') return false;
    node = node.parentElement;
  }
  return true;
};

export const fitElementToBox = (
  element,
  rule = {},
  { getComputedStyle = defaultGetComputedStyle } = {},
) => {
  const modeSize = applyStaticFitMode(element, rule, getComputedStyle(element));
  if (modeSize !== null) return modeSize;

  resetFitStyles(element);
  let computedStyle = getComputedStyle(element);
  const { minFontSize = 1 } = rule;
  let size = cssNumber(computedStyle.fontSize, minFontSize);
  const minimum = Number.isFinite(Number(minFontSize)) ? Number(minFontSize) : 1;
  element.style.fontSize = `${size}px`;
  while (size > minimum && (isOverflowing(element) || isTooTall(element, rule, computedStyle, size))) {
    size = Math.max(minimum, Number((size - 0.5).toFixed(3)));
    element.style.fontSize = `${size}px`;
    computedStyle = getComputedStyle(element);
  }
  const maxHeight = maxTextHeight(element, rule, computedStyle, size);
  if (maxHeight !== null) {
    element.style.maxHeight = `${maxHeight}px`;
    element.style.overflow = 'hidden';
  }
  return size;
};

const fitGwdRule = (root, rule, options) => {
  const sizes = [];
  root.querySelectorAll(`.${rule.cssClass}`).forEach((element) => {
    if (!element.textContent?.trim()) return;
    if (!isVisible(element, options.getComputedStyle)) return;
    sizes.push(fitElementToBox(element, rule, options));
  });
  return sizes.length ? Math.min(...sizes) : undefined;
};

const fitSharedRule = (root, rule, options) => {
  const elements = [...root.querySelectorAll(`.${rule.cssClass}`)]
    .filter((element) => element.textContent?.trim())
    .filter((element) => isVisible(element, options.getComputedStyle));
  if (!elements.length) return undefined;

  const sizes = elements.map((element) => fitElementToBox(element, rule, options));
  const sharedSize = Math.min(...sizes);
  elements.forEach((element) => {
    element.style.fontSize = `${sharedSize}px`;
  });
  return sharedSize;
};

export const applyTextFitting = (
  root,
  rules = [],
  { getComputedStyle = defaultGetComputedStyle } = {},
) => {
  const options = { getComputedStyle };
  const results = new Map();
  for (const rule of rules) {
    const size = rule.mode === 'sharedEqualizedFit'
      ? fitSharedRule(root, rule, options)
      : fitGwdRule(root, rule, options);
    if (size !== undefined) results.set(rule.cssClass, size);
  }
  return results;
};
