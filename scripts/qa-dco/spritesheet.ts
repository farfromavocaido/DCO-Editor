import fs from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';

import {
  loadCopyMatrix,
  matrixSpritesheetTimestamps,
  spritesheetIntervalMs,
} from './build-rows';

export type VariantSheetManifest = {
  size: string;
  sessionId: string;
  variantId: string;
  copySetId: string;
  path: string;
  cellWidth: number;
  cellHeight: number;
  scale: number;
  cols: number;
  rows: number;
  gapPx: number;
  captionHeight: number;
  sheetWidth: number;
  sheetHeight: number;
  timestampsMs: number[];
  readingOrder: string;
};

export type VariantFolderManifest = {
  variantId: string;
  maxLongestEdge: number;
  minScale: number;
  gapPx: number;
  timestampsMs: number[];
  sheets: VariantSheetManifest[];
};

/** Longest edge cap for agent-readable sheets. */
export const MAX_SPRITESHEET_LONGEST_EDGE = 2048;
/** Do not shrink cells below this fraction of native ad size. */
export const MIN_SPRITESHEET_SCALE = 0.75;
/** Gap between frames (also hosts visual separation). */
export const FRAME_GAP_PX = 10;

const HEADER_HEIGHT = 36;
const CAPTION_HEIGHT = 16;

const parseSize = (size: string) => {
  const [w, h] = size.split('x').map(Number);
  if (!w || !h) throw new Error(`Bad size: ${size}`);
  return { width: w, height: h };
};

const padTime = (timeMs: number) => String(timeMs).padStart(4, '0');
const padFrame = (index: number) => String(index + 1).padStart(2, '0');

const listSessionDirs = async (sizeDir: string) => {
  const entries = await fs.readdir(sizeDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
};

const escapeXml = (text: string) => (
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
);

const makeHeaderPng = async (text: string, width: number, height: number) => {
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#111827"/>
      <text
        x="12"
        y="50%"
        dominant-baseline="middle"
        fill="#f9fafb"
        font-family="ui-monospace, SFMono-Regular, Menlo, monospace"
        font-size="12"
      >${escapeXml(text)}</text>
    </svg>
  `;
  return sharp(Buffer.from(svg)).png().toBuffer();
};

/** Caption above each frame: index + timestamp for agent lookup. */
const makeCaptionPng = async (
  frameIndex: number,
  timeMs: number,
  width: number,
  height: number,
  extra = '',
) => {
  const base = `#${padFrame(frameIndex)}  t${padTime(timeMs)}  (${(timeMs / 1000).toFixed(2)}s)`;
  const label = extra ? `${base}  ${extra}` : base;
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#1f2937"/>
      <text
        x="6"
        y="50%"
        dominant-baseline="middle"
        fill="#e5e7eb"
        font-family="ui-monospace, SFMono-Regular, Menlo, monospace"
        font-size="11"
      >${escapeXml(label)}</text>
    </svg>
  `;
  return sharp(Buffer.from(svg)).png().toBuffer();
};

export type VariantLayout = {
  scale: number;
  cols: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  gapPx: number;
  captionHeight: number;
  sheetWidth: number;
  sheetHeight: number;
};

const sheetDims = (
  cols: number,
  rows: number,
  cellW: number,
  cellH: number,
  gapPx: number,
  captionHeight: number,
  headerHeight: number,
) => {
  const sheetWidth = cols * cellW + Math.max(0, cols - 1) * gapPx;
  const blockH = captionHeight + cellH;
  const sheetHeight = headerHeight + rows * blockH + Math.max(0, rows - 1) * gapPx;
  return { sheetWidth, sheetHeight, blockH };
};

/**
 * Fit every frame of one variant onto a single sheet.
 * Prefer fewer rows and higher scale; never go below minScale.
 * May wrap to multiple rows so the full timeline stays on one image.
 */
export const planVariantLayout = (
  nativeW: number,
  nativeH: number,
  frameCount: number,
  options: {
    maxLongestEdge?: number;
    minScale?: number;
    headerHeight?: number;
    gapPx?: number;
    captionHeight?: number;
  } = {},
): VariantLayout => {
  const maxLongestEdge = options.maxLongestEdge ?? MAX_SPRITESHEET_LONGEST_EDGE;
  const minScale = options.minScale ?? MIN_SPRITESHEET_SCALE;
  const headerHeight = options.headerHeight ?? HEADER_HEIGHT;
  const gapPx = options.gapPx ?? FRAME_GAP_PX;
  const captionHeight = options.captionHeight ?? CAPTION_HEIGHT;
  const n = Math.max(1, frameCount);

  let best: VariantLayout | null = null;

  for (let scale = 1; scale >= minScale - 1e-9; scale -= 0.01) {
    const cellW = Math.max(1, Math.round(nativeW * scale));
    const cellH = Math.max(1, Math.round(nativeH * scale));
    const blockH = captionHeight + cellH;

    const maxCols = Math.max(
      1,
      Math.floor((maxLongestEdge + gapPx) / (cellW + gapPx)),
    );
    const maxRows = Math.max(
      1,
      Math.floor((maxLongestEdge - headerHeight + gapPx) / (blockH + gapPx)),
    );

    for (let cols = Math.min(n, maxCols); cols >= 1; cols -= 1) {
      const rows = Math.ceil(n / cols);
      if (rows > maxRows) continue;
      const { sheetWidth, sheetHeight } = sheetDims(
        cols,
        rows,
        cellW,
        cellH,
        gapPx,
        captionHeight,
        headerHeight,
      );
      if (Math.max(sheetWidth, sheetHeight) > maxLongestEdge) continue;

      const candidate: VariantLayout = {
        scale,
        cols,
        rows,
        cellWidth: cellW,
        cellHeight: cellH,
        gapPx,
        captionHeight,
        sheetWidth,
        sheetHeight,
      };

      if (
        !best
        || candidate.rows < best.rows
        || (candidate.rows === best.rows && candidate.scale > best.scale + 1e-9)
        || (
          candidate.rows === best.rows
          && Math.abs(candidate.scale - best.scale) < 1e-9
          && candidate.cols > best.cols
        )
      ) {
        best = candidate;
      }
      break;
    }
  }

  if (best) return best;

  const scale = minScale;
  const cellW = Math.max(1, Math.round(nativeW * scale));
  const cellH = Math.max(1, Math.round(nativeH * scale));
  const cols = Math.max(
    1,
    Math.min(n, Math.floor((maxLongestEdge + gapPx) / (cellW + gapPx))),
  );
  const rows = Math.ceil(n / cols);
  const { sheetWidth, sheetHeight } = sheetDims(
    cols,
    rows,
    cellW,
    cellH,
    gapPx,
    captionHeight,
    headerHeight,
  );
  return {
    scale,
    cols,
    rows,
    cellWidth: cellW,
    cellHeight: cellH,
    gapPx,
    captionHeight,
    sheetWidth,
    sheetHeight,
  };
};

type SessionJob = {
  size: string;
  sessionId: string;
  variantId: string;
  copySetId: string;
};

/**
 * Build one spritesheet per size×session, grouped as:
 * `spritesheets/{variantId}/{copySetId}/{size}.png`
 */
export const buildSpritesheets = async (
  outputDir: string,
  sizes: string[],
  options: {
    maxLongestEdge?: number;
    minScale?: number;
    gapPx?: number;
  } = {},
): Promise<VariantSheetManifest[]> => {
  const matrix = loadCopyMatrix();
  const timestamps = matrixSpritesheetTimestamps(matrix);
  const sheetStepMs = spritesheetIntervalMs(matrix);
  const sheetStepLabel = sheetStepMs % 1000 === 0
    ? `${sheetStepMs / 1000}s`
    : `${sheetStepMs}ms`;
  const maxLongestEdge = options.maxLongestEdge ?? MAX_SPRITESHEET_LONGEST_EDGE;
  const minScale = options.minScale ?? MIN_SPRITESHEET_SCALE;
  const gapPx = options.gapPx ?? FRAME_GAP_PX;
  const sheetRoot = path.resolve(outputDir, 'spritesheets');
  await fs.mkdir(sheetRoot, { recursive: true });

  // Wipe previous spritesheet tree (old size-first and new variant-first layouts).
  try {
    const existing = await fs.readdir(sheetRoot, { withFileTypes: true });
    await Promise.all(existing.map(async (entry) => {
      await fs.rm(path.resolve(sheetRoot, entry.name), { recursive: true, force: true });
    }));
  } catch {
    // ignore
  }

  const jobs: SessionJob[] = [];
  for (const size of sizes) {
    const sizeDir = path.resolve(outputDir, size);
    let sessions: string[] = [];
    try {
      sessions = await listSessionDirs(sizeDir);
    } catch {
      continue;
    }
    for (const sessionId of sessions) {
      const [variantId = sessionId, copySetId = ''] = sessionId.split('__');
      jobs.push({ size, sessionId, variantId, copySetId });
    }
  }

  jobs.sort((a, b) => (
    a.variantId.localeCompare(b.variantId)
    || a.copySetId.localeCompare(b.copySetId)
    || a.size.localeCompare(b.size)
  ));

  const allSheets: VariantSheetManifest[] = [];
  const byVariant = new Map<string, VariantSheetManifest[]>();
  const readingOrder = 'left-to-right, then top-to-bottom';
  const layoutCache = new Map<string, VariantLayout>();

  for (const job of jobs) {
    const { width: nativeW, height: nativeH } = parseSize(job.size);
    let layout = layoutCache.get(job.size);
    if (!layout) {
      layout = planVariantLayout(nativeW, nativeH, timestamps.length, {
        maxLongestEdge,
        minScale,
        headerHeight: HEADER_HEIGHT,
        gapPx,
        captionHeight: CAPTION_HEIGHT,
      });
      layoutCache.set(job.size, layout);
    }

    const outDir = path.resolve(sheetRoot, job.variantId, job.copySetId);
    await fs.mkdir(outDir, { recursive: true });

    const header = await makeHeaderPng(
      `${job.size} · ${job.sessionId} · scale ${Math.round(layout.scale * 100)}% · ${timestamps.length} frames @ ${sheetStepLabel} · read ${readingOrder}`,
      layout.sheetWidth,
      HEADER_HEIGHT,
    );

    const composites: sharp.OverlayOptions[] = [{
      input: header,
      left: 0,
      top: 0,
    }];

    const blockH = layout.captionHeight + layout.cellHeight;
    const strideX = layout.cellWidth + layout.gapPx;
    const strideY = blockH + layout.gapPx;
    const sizeDir = path.resolve(outputDir, job.size);

    for (let index = 0; index < timestamps.length; index += 1) {
      const timeMs = timestamps[index]!;
      const col = index % layout.cols;
      const row = Math.floor(index / layout.cols);
      const left = col * strideX;
      const top = HEADER_HEIGHT + row * strideY;

      composites.push({
        input: await makeCaptionPng(
          index,
          timeMs,
          layout.cellWidth,
          layout.captionHeight,
        ),
        left,
        top,
      });

      const framePath = path.resolve(
        sizeDir,
        job.sessionId,
        `t${padTime(timeMs)}.png`,
      );
      try {
        const frame = layout.scale === 1
          ? framePath
          : await sharp(framePath)
            .resize(layout.cellWidth, layout.cellHeight, { fit: 'fill' })
            .png()
            .toBuffer();
        composites.push({
          input: frame,
          left,
          top: top + layout.captionHeight,
        });
      } catch {
        // Missing frame: leave blank under caption
      }
    }

    const outPath = path.resolve(outDir, `${job.size}.png`);
    await sharp({
      create: {
        width: layout.sheetWidth,
        height: layout.sheetHeight,
        channels: 3,
        background: { r: 20, g: 24, b: 32 },
      },
    })
      .composite(composites)
      .png({ compressionLevel: 8 })
      .toFile(outPath);

    const manifest: VariantSheetManifest = {
      size: job.size,
      sessionId: job.sessionId,
      variantId: job.variantId,
      copySetId: job.copySetId,
      path: path.relative(outputDir, outPath),
      cellWidth: layout.cellWidth,
      cellHeight: layout.cellHeight,
      scale: layout.scale,
      cols: layout.cols,
      rows: layout.rows,
      gapPx: layout.gapPx,
      captionHeight: layout.captionHeight,
      sheetWidth: layout.sheetWidth,
      sheetHeight: layout.sheetHeight,
      timestampsMs: timestamps,
      readingOrder,
    };
    allSheets.push(manifest);
    const bucket = byVariant.get(job.variantId) ?? [];
    bucket.push(manifest);
    byVariant.set(job.variantId, bucket);

    process.stdout.write(
      `Spritesheet ${job.variantId}/${job.copySetId}/${job.size}: ${layout.cols}×${layout.rows} @ ${Math.round(layout.scale * 100)}% (${layout.sheetWidth}×${layout.sheetHeight})\n`,
    );
  }

  const variantManifests: VariantFolderManifest[] = [];
  for (const variantId of [...byVariant.keys()].sort()) {
    const sheets = byVariant.get(variantId)!;
    const variantManifest: VariantFolderManifest = {
      variantId,
      maxLongestEdge,
      minScale,
      gapPx,
      timestampsMs: timestamps,
      sheets,
    };
    await fs.writeFile(
      path.resolve(sheetRoot, variantId, 'index.json'),
      `${JSON.stringify(variantManifest, null, 2)}\n`,
      'utf8',
    );
    variantManifests.push(variantManifest);
  }

  await fs.writeFile(
    path.resolve(sheetRoot, 'index.json'),
    `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      maxLongestEdge,
      minScale,
      gapPx,
      readingOrder,
      note: 'One spritesheet per size×copy; folder per layout variant, then short/long. Path: spritesheets/{variant}/{copy}/{size}.png. Caption above each frame: #NN tMMMM.',
      variants: variantManifests,
    }, null, 2)}\n`,
    'utf8',
  );

  return allSheets;
};

export const SETTLED_SHEETS_DIRNAME = 'settled';

export type SettledSheetManifest = {
  size: string;
  sessionId: string;
  variantId: string;
  copySetId: string;
  path: string;
  holdsMs: number[];
  labels: string[][];
  cellWidth: number;
  cellHeight: number;
  scale: number;
  cols: number;
  rows: number;
  sheetWidth: number;
  sheetHeight: number;
};

/**
 * One spritesheet per session×size using only derived settled hold frames.
 * Grouped by size for human scanning: `settled/{size}/{sessionId}.png`
 */
export const buildSettledSpritesheets = async (
  outputDir: string,
  options: {
    holdSamplesPath?: string;
    maxLongestEdge?: number;
    /** Prefer native cells; only shrink if the sheet won't fit. */
    minScale?: number;
    gapPx?: number;
  } = {},
): Promise<SettledSheetManifest[]> => {
  const holdSamplesPath = options.holdSamplesPath
    || path.resolve(outputDir, 'hold-samples.json');
  const raw = await fs.readFile(holdSamplesPath, 'utf8');
  const holdSamples = JSON.parse(raw) as {
    bySession: Record<string, {
      variantId: string;
      copySetId?: string;
      bySize: Record<string, {
        holdsMs: number[];
        frames: string[];
        samples?: Array<{ tMs: number; labels: string[] }>;
      }>;
    }>;
  };

  const maxLongestEdge = options.maxLongestEdge ?? MAX_SPRITESHEET_LONGEST_EDGE;
  // Prefer native cells (planner starts at 1.0); allow shrink only if needed to fit.
  const minScale = options.minScale ?? MIN_SPRITESHEET_SCALE;
  const gapPx = options.gapPx ?? FRAME_GAP_PX;
  const settledRoot = path.resolve(outputDir, SETTLED_SHEETS_DIRNAME);
  await fs.rm(settledRoot, { recursive: true, force: true });
  await fs.mkdir(settledRoot, { recursive: true });

  const readingOrder = 'left-to-right, then top-to-bottom';
  const manifests: SettledSheetManifest[] = [];

  const jobs = Object.entries(holdSamples.bySession).flatMap(([sessionId, session]) => (
    Object.entries(session.bySize).map(([size, sizeHolds]) => ({
      sessionId,
      size,
      variantId: session.variantId,
      copySetId: session.copySetId || sessionId.split('__')[1] || '',
      holdsMs: sizeHolds.holdsMs || [],
      samples: sizeHolds.samples || [],
    }))
  )).filter((job) => job.holdsMs.length > 0);

  jobs.sort((a, b) => (
    a.size.localeCompare(b.size)
    || a.variantId.localeCompare(b.variantId)
    || a.copySetId.localeCompare(b.copySetId)
  ));

  for (const job of jobs) {
    const { width: nativeW, height: nativeH } = parseSize(job.size);
    const layout = planVariantLayout(nativeW, nativeH, job.holdsMs.length, {
      maxLongestEdge,
      minScale,
      headerHeight: HEADER_HEIGHT,
      gapPx,
      captionHeight: CAPTION_HEIGHT,
    });

    const labelByMs = new Map(
      job.samples.map((sample) => [sample.tMs, sample.labels.join('+')]),
    );
    const labels = job.holdsMs.map((tMs) => {
      const sample = job.samples.find((item) => item.tMs === tMs);
      return sample?.labels || [];
    });

    const header = await makeHeaderPng(
      `${job.size} · ${job.sessionId} · SETTLED · ${job.holdsMs.length} holds · scale ${Math.round(layout.scale * 100)}% · read ${readingOrder}`,
      layout.sheetWidth,
      HEADER_HEIGHT,
    );

    const composites: sharp.OverlayOptions[] = [{
      input: header,
      left: 0,
      top: 0,
    }];

    const blockH = layout.captionHeight + layout.cellHeight;
    const strideX = layout.cellWidth + layout.gapPx;
    const strideY = blockH + layout.gapPx;
    const sessionDir = path.resolve(outputDir, job.size, job.sessionId);

    for (let index = 0; index < job.holdsMs.length; index += 1) {
      const timeMs = job.holdsMs[index]!;
      const col = index % layout.cols;
      const row = Math.floor(index / layout.cols);
      const left = col * strideX;
      const top = HEADER_HEIGHT + row * strideY;
      const extra = labelByMs.get(timeMs) || '';

      composites.push({
        input: await makeCaptionPng(
          index,
          timeMs,
          layout.cellWidth,
          layout.captionHeight,
          extra,
        ),
        left,
        top,
      });

      const framePath = path.resolve(sessionDir, `t${padTime(timeMs)}.png`);
      try {
        const frame = layout.scale === 1
          ? framePath
          : await sharp(framePath)
            .resize(layout.cellWidth, layout.cellHeight, { fit: 'fill' })
            .png()
            .toBuffer();
        composites.push({
          input: frame,
          left,
          top: top + layout.captionHeight,
        });
      } catch {
        // Missing frame: leave blank under caption
      }
    }

    const sizeDir = path.resolve(settledRoot, job.size);
    await fs.mkdir(sizeDir, { recursive: true });
    const fileName = `${job.sessionId}.png`;
    const outPath = path.resolve(sizeDir, fileName);
    await sharp({
      create: {
        width: layout.sheetWidth,
        height: layout.sheetHeight,
        channels: 3,
        background: { r: 20, g: 24, b: 32 },
      },
    })
      .composite(composites)
      .png({ compressionLevel: 8 })
      .toFile(outPath);

    manifests.push({
      size: job.size,
      sessionId: job.sessionId,
      variantId: job.variantId,
      copySetId: job.copySetId,
      path: path.relative(outputDir, outPath),
      holdsMs: job.holdsMs,
      labels,
      cellWidth: layout.cellWidth,
      cellHeight: layout.cellHeight,
      scale: layout.scale,
      cols: layout.cols,
      rows: layout.rows,
      sheetWidth: layout.sheetWidth,
      sheetHeight: layout.sheetHeight,
    });

    process.stdout.write(
      `Settled ${job.size}/${fileName}: ${job.holdsMs.length} holds · ${layout.cols}×${layout.rows} @ ${Math.round(layout.scale * 100)}%\n`,
    );
  }

  await fs.writeFile(
    path.resolve(settledRoot, 'index.json'),
    `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      maxLongestEdge,
      minScale,
      gapPx,
      readingOrder,
      note: 'Settled-hold spritesheets grouped by size: settled/{size}/{sessionId}.png. Caption includes hold labels (headline/offer/legal/roundel/cta).',
      sheets: manifests,
    }, null, 2)}\n`,
    'utf8',
  );

  return manifests;
};
