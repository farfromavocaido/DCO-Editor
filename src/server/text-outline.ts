import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

import { MUSEO_FONT_FILENAME } from '@/lib/brand-font';
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
  unitsPerEm: number;
  getAdvanceWidth: (text: string, fontSize: number) => number;
  stringToGlyphs: (text: string) => Array<{
    advanceWidth: number;
    getPath: (x: number, y: number, fontSize: number) => unknown;
  }>;
};

export type OutlineFitOptions = {
  text: string;
  fontSize: number;
  width: number;
  height?: number;
  color?: string;
  textAlign?: 'left' | 'center' | 'right';
  allowShrink?: boolean;
  wrap?: boolean;
  maxLines?: number;
  minFontSize?: number;
  trackingMinEm?: number;
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

const measureWidth = (font: Font, text: string, fontSize: number, trackingEm: number) => {
  if (!text) return 0;
  const advance = font.getAdvanceWidth(text, fontSize);
  const trackingPx = trackingEm * fontSize * Math.max(0, text.length - 1);
  return advance + trackingPx;
};

const wrapLines = (
  font: Font,
  text: string,
  fontSize: number,
  trackingEm: number,
  maxWidth: number,
  maxLines: number,
) => {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines: string[] = [];
  let current = words[0];
  for (let index = 1; index < words.length; index += 1) {
    const candidate = `${current} ${words[index]}`;
    if (measureWidth(font, candidate, fontSize, trackingEm) <= maxWidth) {
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

const lineHeightFor = (fontSize: number) => fontSize * 1.05;

const buildPathForLines = (
  font: Font,
  lines: string[],
  fontSize: number,
  trackingEm: number,
  width: number,
  textAlign: 'left' | 'center' | 'right',
) => {
  const path = new opentype.Path();
  const lineHeight = lineHeightFor(fontSize);
  const ascender = (font.ascender / font.unitsPerEm) * fontSize;
  lines.forEach((line, lineIndex) => {
    const lineWidth = measureWidth(font, line, fontSize, trackingEm);
    let x = 0;
    if (textAlign === 'center') x = Math.max(0, (width - lineWidth) / 2);
    if (textAlign === 'right') x = Math.max(0, width - lineWidth);
    const y = ascender + lineIndex * lineHeight;
    if (!line) return;
    // Manual kerning-aware draw so letter-spacing can be applied between glyphs.
    const glyphs = font.stringToGlyphs(line);
    let cursor = x;
    for (let index = 0; index < glyphs.length; index += 1) {
      const glyph = glyphs[index];
      const glyphPath = glyph.getPath(cursor, y, fontSize);
      path.extend(glyphPath);
      cursor += (glyph.advanceWidth / font.unitsPerEm) * fontSize;
      if (index < glyphs.length - 1) cursor += trackingEm * fontSize;
    }
  });
  return path;
};

/** Fit text into a box using Museo metrics, then emit an inline SVG of glyph outlines. */
export const outlineFittedText = async (options: OutlineFitOptions): Promise<OutlinedText> => {
  const font = await loadMuseoFont();
  const text = String(options.text ?? '');
  const width = Math.max(1, Number(options.width) || 1);
  const allowShrink = options.allowShrink !== false;
  const wrap = Boolean(options.wrap);
  const maxLines = Math.max(1, Number(options.maxLines) || (wrap ? 2 : 1));
  const minFontSize = Math.max(4, Number(options.minFontSize) || 6);
  const trackingFloor = Number.isFinite(options.trackingMinEm) ? Number(options.trackingMinEm) : 0;
  const textAlign = options.textAlign || 'left';
  const color = options.color || '#FFFFFF';

  let fontSize = Math.max(minFontSize, Number(options.fontSize) || 12);
  let trackingEm = 0;
  let lines = wrap
    ? wrapLines(font, text, fontSize, trackingEm, width, maxLines)
    : [text];

  const overflows = () => {
    const widest = Math.max(...lines.map((line) => measureWidth(font, line, fontSize, trackingEm)), 0);
    const blockHeight = lines.length * lineHeightFor(fontSize);
    const maxHeight = Number(options.height) || blockHeight;
    return widest > width + 0.5 || blockHeight > maxHeight + 0.5;
  };

  if (trackingFloor < 0 && overflows()) {
    while (trackingEm > trackingFloor && overflows()) {
      trackingEm = Math.max(trackingFloor, Number((trackingEm - 0.005).toFixed(3)));
      lines = wrap
        ? wrapLines(font, text, fontSize, trackingEm, width, maxLines)
        : [text];
    }
  }

  if (allowShrink) {
    while (fontSize > minFontSize && overflows()) {
      fontSize = Math.max(minFontSize, Number((fontSize - 0.5).toFixed(3)));
      lines = wrap
        ? wrapLines(font, text, fontSize, trackingEm, width, maxLines)
        : [text];
    }
  }

  const path = buildPathForLines(font, lines, fontSize, trackingEm, width, textAlign);
  const height = Math.max(1, Number(options.height) || lines.length * lineHeightFor(fontSize));
  const svgPath = path.toSVG(2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true"><g fill="${color}">${svgPath}</g></svg>`;
  return {
    svg,
    fontSize,
    letterSpacingEm: trackingEm,
    lines,
  };
};
