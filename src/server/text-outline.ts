import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

import { MUSEO_FONT_FILENAME } from '@/lib/brand-font';
import { parseOfferValueParts } from '@/lib/offer-value-symbols';
import { projectRoot } from './paths';

// opentype.js ships dual CJS/ESM; Turbopack resolves the .mjs (named exports)
// while Node/vitest often expose the CJS default. Require keeps both happy in
// this Node-only outline path.
const require = createRequire(import.meta.url);
const opentype = require('opentype.js') as {
  parse: (buffer: ArrayBuffer, opt?: unknown) => Font;
  Path: new () => {
    extend: (other: unknown) => void;
    toSVG: (decimalPlaces?: number) => string;
  };
};

type Font = {
  ascender: number;
  descender: number;
  unitsPerEm: number;
  getAdvanceWidth: (text: string, fontSize: number) => number;
  stringToGlyphs: (text: string) => Array<{
    advanceWidth: number;
    getBoundingBox?: () => { y1: number; y2: number };
    getPath: (x: number, y: number, fontSize: number) => unknown;
  }>;
};

type GlyphRun = {
  text: string;
  fontSize: number;
  /** Extra Y after baseline so ink bottoms match digits (symbol align). */
  baselineNudgeY?: number;
};

export type OutlineFitOptions = {
  text: string;
  fontSize: number;
  width: number;
  height?: number;
  color?: string;
  textAlign?: 'left' | 'center' | 'right';
  /** CSS unitless line-height (e.g. 1.25). Defaults to 1.05 when omitted/invalid. */
  lineHeight?: number;
  /**
   * Starting / locked letter-spacing in em of `fontSize`.
   * Snapshot bake passes the editor’s final value; fit mode starts here then
   * may squeeze toward `trackingMinEm`.
   */
  letterSpacingEm?: number;
  allowShrink?: boolean;
  /** When true, do not change fontSize or letterSpacing — pure bake. */
  lockMetrics?: boolean;
  wrap?: boolean;
  maxLines?: number;
  minFontSize?: number;
  trackingMinEm?: number;
  /** Scale trailing % / leading £€ to 0.6em and ink-bottom-align (offer values). */
  scaleOfferSymbols?: boolean;
  /** text-fit align:bottom translateY — applied as SVG group translate. */
  alignOffsetY?: number;
};

export type OutlinedText = {
  svg: string;
  fontSize: number;
  letterSpacingEm: number;
  lines: string[];
};

let cachedFont: Font | null = null;

export const museoFontPath = () => path.resolve(projectRoot, 'assets/fonts', MUSEO_FONT_FILENAME);

export const loadMuseoFont = async () => {
  if (cachedFont) return cachedFont;
  const buffer = await fs.readFile(museoFontPath());
  cachedFont = opentype.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  return cachedFont;
};

const OFFER_SYMBOL_SCALE = 0.6;

const normalizeLineHeight = (value: unknown, fallback = 1.15) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

/** CSS line-box height: unitless multipliers → px; values > 4 treated as already-px. */
const lineBoxPx = (fontSize: number, lineHeight: number) => (
  lineHeight > 4 ? lineHeight : fontSize * lineHeight
);

/**
 * CSS inline layout baseline inside a line box (half-leading).
 * content = ascender − descender (descender is typically negative in the face).
 * halfLeading = (lineBox − content) / 2 — negative when lineHeight is tight
 * (e.g. offer values at 0.85), which pulls the baseline up so ink stays in-box.
 */
const cssBaselineY = (font: Font, fontSize: number, lineBox: number, lineIndex: number) => {
  const ascender = (font.ascender / font.unitsPerEm) * fontSize;
  const descender = (font.descender / font.unitsPerEm) * fontSize;
  const content = ascender - descender;
  const halfLeading = (lineBox - content) / 2;
  return ascender + halfLeading + lineIndex * lineBox;
};

const glyphInkDescent = (
  glyph: { getBoundingBox?: () => { y1: number; y2: number } },
  font: Font,
  fontSize: number,
) => {
  if (typeof glyph.getBoundingBox !== 'function') return 0;
  const bbox = glyph.getBoundingBox();
  // Font units: y1 is the lowest extent (negative = below baseline).
  if (!bbox || !Number.isFinite(bbox.y1)) return 0;
  return Math.max(0, -(bbox.y1 / font.unitsPerEm) * fontSize);
};

const referenceDigitDescent = (font: Font, fontSize: number) => {
  const glyph = font.stringToGlyphs('5')[0];
  return glyph ? glyphInkDescent(glyph, font, fontSize) : 0;
};

const runsForLine = (
  font: Font,
  line: string,
  fontSize: number,
  scaleOfferSymbols: boolean,
): GlyphRun[] => {
  if (!scaleOfferSymbols) return [{ text: line, fontSize }];
  const parts = parseOfferValueParts(line);
  const symbolSize = fontSize * OFFER_SYMBOL_SCALE;
  const digitDescent = referenceDigitDescent(font, fontSize);
  const runs: GlyphRun[] = [];
  if (parts.prefix) {
    const glyph = font.stringToGlyphs(parts.prefix)[0];
    const symbolDescent = glyph ? glyphInkDescent(glyph, font, symbolSize) : 0;
    runs.push({
      text: parts.prefix,
      fontSize: symbolSize,
      baselineNudgeY: digitDescent - symbolDescent,
    });
  }
  if (parts.body) runs.push({ text: parts.body, fontSize });
  if (parts.suffix) {
    const glyph = font.stringToGlyphs(parts.suffix)[0];
    const symbolDescent = glyph ? glyphInkDescent(glyph, font, symbolSize) : 0;
    runs.push({
      text: parts.suffix,
      fontSize: symbolSize,
      baselineNudgeY: digitDescent - symbolDescent,
    });
  }
  return runs.length ? runs : [{ text: line, fontSize }];
};

/** Letter-spacing is in em of the host font-size (CSS), between every pair of glyphs. */
const measureRunsWidth = (
  font: Font,
  runs: GlyphRun[],
  hostFontSize: number,
  trackingEm: number,
) => {
  let width = 0;
  let glyphCount = 0;
  for (const run of runs) {
    if (!run.text) continue;
    width += font.getAdvanceWidth(run.text, run.fontSize);
    glyphCount += font.stringToGlyphs(run.text).length;
  }
  if (glyphCount > 1) width += trackingEm * hostFontSize * (glyphCount - 1);
  return width;
};

const measureWidth = (
  font: Font,
  text: string,
  fontSize: number,
  trackingEm: number,
  scaleOfferSymbols: boolean,
) => {
  if (!text) return 0;
  const runs = runsForLine(font, text, fontSize, scaleOfferSymbols);
  return measureRunsWidth(font, runs, fontSize, trackingEm);
};

const wrapLines = (
  font: Font,
  text: string,
  fontSize: number,
  trackingEm: number,
  maxWidth: number,
  maxLines: number,
  scaleOfferSymbols: boolean,
) => {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines: string[] = [];
  let current = words[0];
  for (let index = 1; index < words.length; index += 1) {
    const candidate = `${current} ${words[index]}`;
    if (measureWidth(font, candidate, fontSize, trackingEm, scaleOfferSymbols) <= maxWidth) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = words[index];
    if (lines.length >= maxLines - 1) {
      const rest = [current, ...words.slice(index + 1)].join(' ');
      lines.push(rest);
      return lines.slice(0, maxLines);
    }
  }
  lines.push(current);
  return lines;
};

type PathCommand = {
  type: string;
  x?: number;
  y?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
};

type MutablePath = {
  commands: PathCommand[];
  extend: (other: unknown) => void;
  toSVG: (decimalPlaces?: number) => string;
};

/**
 * opentype.js `roundDecimal` builds keys like `1.77e-15 + "e+2"` → `"…e-15e+2"` → NaN
 * for float crumbs (e.g. 9.000000000000002 from Museo glyph math). Pre-quantize
 * coordinates so toSVG never hits that path.
 */
const quantizePathCommands = (path: MutablePath, places = 2) => {
  const factor = 10 ** places;
  path.commands = path.commands.map((cmd) => {
    const next: PathCommand = { type: cmd.type };
    for (const key of ['x', 'y', 'x1', 'y1', 'x2', 'y2'] as const) {
      const value = cmd[key];
      if (typeof value !== 'number') continue;
      next[key] = Number.isFinite(value) ? Math.round(value * factor) / factor : 0;
    }
    return next;
  });
  return path;
};

const buildPathForLines = (
  font: Font,
  lines: string[],
  fontSize: number,
  trackingEm: number,
  width: number,
  textAlign: 'left' | 'center' | 'right',
  lineHeight: number,
  scaleOfferSymbols: boolean,
) => {
  const path = new opentype.Path() as MutablePath;
  const lineBox = lineBoxPx(fontSize, lineHeight);
  lines.forEach((line, lineIndex) => {
    const runs = runsForLine(font, line, fontSize, scaleOfferSymbols);
    const lineWidth = measureRunsWidth(font, runs, fontSize, trackingEm);
    let x = 0;
    if (textAlign === 'center') x = Math.max(0, (width - lineWidth) / 2);
    if (textAlign === 'right') x = Math.max(0, width - lineWidth);
    // Match browser CSS: baseline sits at ascender + half-leading within the line box.
    const y = cssBaselineY(font, fontSize, lineBox, lineIndex);
    if (!line) return;
    let cursor = x;
    let remainingGlyphs = runs.reduce((count, run) => (
      count + (run.text ? font.stringToGlyphs(run.text).length : 0)
    ), 0);
    for (const run of runs) {
      if (!run.text) continue;
      const glyphs = font.stringToGlyphs(run.text);
      const drawY = y + (Number(run.baselineNudgeY) || 0);
      for (let index = 0; index < glyphs.length; index += 1) {
        const glyph = glyphs[index];
        const glyphPath = glyph.getPath(cursor, drawY, run.fontSize);
        path.extend(glyphPath);
        cursor += (glyph.advanceWidth / font.unitsPerEm) * run.fontSize;
        remainingGlyphs -= 1;
        if (remainingGlyphs > 0) cursor += trackingEm * fontSize;
      }
    }
  });
  return quantizePathCommands(path);
};

/** Fit text into a box using Museo metrics, then emit an inline SVG of glyph outlines. */
export const outlineFittedText = async (options: OutlineFitOptions): Promise<OutlinedText> => {
  const font = await loadMuseoFont();
  const text = String(options.text ?? '');
  const width = Math.max(1, Number(options.width) || 1);
  const lockMetrics = Boolean(options.lockMetrics);
  const allowShrink = lockMetrics ? false : options.allowShrink !== false;
  const wrap = Boolean(options.wrap);
  const maxLines = Math.max(1, Number(options.maxLines) || (wrap ? 2 : 1));
  const minFontSize = Math.max(4, Number(options.minFontSize) || 6);
  const trackingFloor = Number.isFinite(options.trackingMinEm) ? Number(options.trackingMinEm) : 0;
  const textAlign = options.textAlign || 'left';
  const color = options.color || '#FFFFFF';
  const lineHeight = normalizeLineHeight(options.lineHeight);
  const scaleOfferSymbols = Boolean(options.scaleOfferSymbols);
  const alignOffsetY = Number(options.alignOffsetY) || 0;
  const startingTracking = Number.isFinite(options.letterSpacingEm)
    ? Number(options.letterSpacingEm)
    : 0;

  let fontSize = Math.max(minFontSize, Number(options.fontSize) || 12);
  let trackingEm = startingTracking;
  let lines = wrap
    ? wrapLines(font, text, fontSize, trackingEm, width, maxLines, scaleOfferSymbols)
    : [text];

  const overflows = () => {
    const widest = Math.max(
      ...lines.map((line) => measureWidth(font, line, fontSize, trackingEm, scaleOfferSymbols)),
      0,
    );
    const blockHeight = lines.length * lineBoxPx(fontSize, lineHeight);
    const maxHeight = Number(options.height) || blockHeight;
    return widest > width + 0.5 || blockHeight > maxHeight + 0.5;
  };

  if (!lockMetrics && trackingFloor < trackingEm && overflows()) {
    while (trackingEm > trackingFloor && overflows()) {
      trackingEm = Math.max(trackingFloor, Number((trackingEm - 0.005).toFixed(3)));
      lines = wrap
        ? wrapLines(font, text, fontSize, trackingEm, width, maxLines, scaleOfferSymbols)
        : [text];
    }
  }

  if (allowShrink) {
    while (fontSize > minFontSize && overflows()) {
      fontSize = Math.max(minFontSize, Number((fontSize - 0.5).toFixed(3)));
      lines = wrap
        ? wrapLines(font, text, fontSize, trackingEm, width, maxLines, scaleOfferSymbols)
        : [text];
    }
  }

  const path = buildPathForLines(
    font,
    lines,
    fontSize,
    trackingEm,
    width,
    textAlign,
    lineHeight,
    scaleOfferSymbols,
  );
  // SVG height = CSS line boxes (not raw em). Host flex (CTA / headlines) still
  // centres a shorter block; offer hosts keep authored absolute tops/heights.
  const height = Math.max(1, lines.length * lineBoxPx(fontSize, lineHeight));
  const svgPath = path.toSVG(2);
  const groupOpen = Math.abs(alignOffsetY) > 0.01
    ? `<g fill="${color}" transform="translate(0 ${alignOffsetY.toFixed(2)})">`
    : `<g fill="${color}">`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true">${groupOpen}${svgPath}</g></svg>`;
  return {
    svg,
    fontSize,
    letterSpacingEm: trackingEm,
    lines,
  };
};
