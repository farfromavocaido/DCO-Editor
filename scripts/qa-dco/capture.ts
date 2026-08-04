import fs from 'node:fs/promises';
import path from 'node:path';

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

import {
  buildFeedRow,
  expandMatrixRows,
  loadCopyMatrix,
  matrixFrameTimestamps,
  type CopyMatrix,
  type MatrixRow,
} from './build-rows';
import { agencyTimelineSeekEvaluateSource } from '../../src/lib/agency-timeline-seek';
import { DEFAULT_QA_WORK_DIR } from './export-shell';
import { startQaServer, type QaServer } from './serve';
import { writeHoldSamplesManifest } from './hold-samples';
import { buildSettledSpritesheets, buildSpritesheets, SETTLED_SHEETS_DIRNAME } from './spritesheet';

export type CaptureFilters = {
  sizes?: string[];
  variantIds?: string[];
  copySetIds?: string[];
};

export type CaptureOptions = {
  workDir?: string;
  outputDir: string;
  filters?: CaptureFilters;
  headed?: boolean;
  /** Parallel browser pages. Default: 12. Forced to 1 when headed. */
  concurrency?: number;
};

export const defaultCaptureConcurrency = () => 12;

const mapPool = async <T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> => {
  const results = new Array<R>(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index]!, index);
    }
  });
  await Promise.all(runners);
  return results;
};

type FitIssue = {
  id: string;
  field: string | null;
  className: string;
  title: string | null;
  text: string;
  scrollWidth: number;
  clientWidth: number;
  scrollHeight: number;
  clientHeight: number;
  reason: 'clipped' | 'overflow';
};

type FrameMetrics = {
  timeMs: number;
  clippedCount: number;
  overflowCount: number;
  issues: FitIssue[];
};

const padTime = (timeMs: number) => String(timeMs).padStart(4, '0');

const parseSize = (size: string) => {
  const [w, h] = size.split('x').map(Number);
  if (!w || !h) throw new Error(`Bad size: ${size}`);
  return { width: w, height: h };
};

// Stringified browser snippets avoid tsx/esbuild injecting `__name` into page.evaluate.
// Only flag issues for elements that are painted on-stage (ancestor opacity + stage intersection).
const COLLECT_FIT_ISSUES = `(() => {
  const root = document.getElementById('page-content');
  if (!root) return [];
  const rootRect = root.getBoundingClientRect();
  const onStage = (el) => {
    let node = el;
    while (node && node.nodeType === 1) {
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      if (Number(style.opacity || '1') < 0.05) return false;
      if (node === root) break;
      node = node.parentElement;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return false;
    const overlapW = Math.min(rect.right, rootRect.right) - Math.max(rect.left, rootRect.left);
    const overlapH = Math.min(rect.bottom, rootRect.bottom) - Math.max(rect.top, rootRect.top);
    return overlapW > 2 && overlapH > 2;
  };
  const issues = [];
  const seen = new Set();
  for (const el of Array.from(document.querySelectorAll('[data-fit-clipped="true"]'))) {
    if (!onStage(el)) continue;
    seen.add(el);
    issues.push({
      id: el.id || '',
      field: el.getAttribute('data-dco-field'),
      className: el.className || '',
      title: el.getAttribute('title'),
      text: (el.textContent || '').trim().slice(0, 120),
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      reason: 'clipped',
    });
  }
  for (const el of Array.from(document.querySelectorAll('[data-dco-field]'))) {
    if (seen.has(el) || !onStage(el)) continue;
    const widthOverflow = el.clientWidth > 0 && (el.scrollWidth - el.clientWidth) > 0.5;
    const heightOverflow = el.clientHeight > 0 && (el.scrollHeight - el.clientHeight) > 0.5;
    if (!widthOverflow && !heightOverflow) continue;
    issues.push({
      id: el.id || '',
      field: el.getAttribute('data-dco-field'),
      className: el.className || '',
      title: el.getAttribute('title'),
      text: (el.textContent || '').trim().slice(0, 120),
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      reason: 'overflow',
    });
  }
  return issues;
})()`;

const collectFitIssues = async (page: Page): Promise<FitIssue[]> => (
  page.evaluate(COLLECT_FIT_ISSUES) as Promise<FitIssue[]>
);

const seekTimeline = async (page: Page, timeMs: number) => {
  // Shared source with /qa iframe bridge (src/lib/agency-timeline-seek.ts).
  const count = await page.evaluate(agencyTimelineSeekEvaluateSource(timeMs)) as number;
  if (!count && timeMs === 0) {
    await page.waitForTimeout(100);
    await page.evaluate(agencyTimelineSeekEvaluateSource(timeMs));
  }
  await page.waitForTimeout(50);
};

const waitForRuntime = async (page: Page) => {
  // Wait until Enabler (or fallback) has applied the baked sample row once,
  // so our injection is not overwritten by a late StudioEvent.INIT bootstrap.
  await page.waitForFunction(
    'window.__SSE_DCO_READY__ === true && typeof window.applySseDcoRuntimeState === "function"',
    null,
    { timeout: 45_000 },
  );

  await page.evaluate(`(async () => {
    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (e) {}
    }
  })()`);
};

const applyFeedRow = async (page: Page, row: Record<string, unknown>) => {
  const rowJson = JSON.stringify(row);
  const applied = await page.evaluate(`(() => {
    const feedRow = ${rowJson};
    const api = window.applySseDcoRuntimeState;
    if (typeof api !== 'function') {
      throw new Error('applySseDcoRuntimeState is not available');
    }
    api(feedRow);
    const root = document.getElementById('page-content');
    if (root) root.classList.add('motion-ready');
    const h1 = document.querySelector('#headline-act1');
    const slot = document.getElementById('offer1');
    const value = slot && slot.querySelector('.offer-value');
    const bg = document.getElementById('bg-image');
    return {
      heading1: (h1 && h1.textContent) || '',
      offer1: (value && value.textContent) || '',
      bg: (bg && bg.getAttribute('src')) || '',
    };
  })()`) as { heading1: string; offer1: string; bg: string };

  const expectedHeading = String(row.heading1_text || '');
  if (expectedHeading && applied.heading1 !== expectedHeading) {
    throw new Error(
      `Feed inject failed: expected heading1 ${JSON.stringify(expectedHeading)}, got ${JSON.stringify(applied.heading1)}`,
    );
  }

  await page.evaluate(`(async () => {
    const img = document.getElementById('bg-image');
    if (!img || !img.getAttribute('src')) return false;
    if (img.complete && img.naturalWidth > 0) return true;
    await new Promise((resolve) => {
      const done = () => resolve(true);
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
      setTimeout(done, 5000);
    });
    return !!(img.complete && img.naturalWidth > 0);
  })()`);
  await page.waitForTimeout(100);
};

const withBackgroundUrls = (
  matrix: CopyMatrix,
  matrixRow: MatrixRow,
  origin: string,
  index: number,
) => {
  const variant = matrix.variants.find((item) => item.id === matrixRow.variantId);
  const copySet = matrix.copySets.find((item) => item.id === matrixRow.copySetId);
  if (!variant || !copySet) {
    throw new Error(`Unknown variant/copy for ${matrixRow.sessionId}`);
  }
  return buildFeedRow(matrix, variant, copySet, {
    backgroundBaseUrl: origin,
    index,
  });
};

const captureSession = async (
  page: Page,
  options: {
    origin: string;
    size: string;
    matrix: CopyMatrix;
    matrixRow: MatrixRow;
    sessionDir: string;
    timestamps: number[];
    index: number;
  },
) => {
  const { width, height } = parseSize(options.size);
  await page.setViewportSize({ width, height });

  const url = `${options.origin}/ads/${options.size}/index.html`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await waitForRuntime(page);

  const feedRow = withBackgroundUrls(
    options.matrix,
    options.matrixRow,
    options.origin,
    options.index,
  );
  await applyFeedRow(page, feedRow);

  const frames: FrameMetrics[] = [];
  for (const timeMs of options.timestamps) {
    await seekTimeline(page, timeMs);
    const issues = await collectFitIssues(page);
    const filename = `t${padTime(timeMs)}.png`;
    // Keep sought animation times; do not let Playwright finish CSS animations.
    await page.locator('#page-content').screenshot({
      path: path.join(options.sessionDir, filename),
      animations: 'allow',
      caret: 'hide',
    });
    frames.push({
      timeMs,
      clippedCount: issues.filter((item) => item.reason === 'clipped').length,
      overflowCount: issues.filter((item) => item.reason === 'overflow').length,
      issues,
    });
  }

  const meta = {
    size: options.size,
    variantId: options.matrixRow.variantId,
    copySetId: options.matrixRow.copySetId,
    sessionId: options.matrixRow.sessionId,
    url,
    feedRow,
    frames,
  };
  await fs.writeFile(
    path.join(options.sessionDir, 'meta.json'),
    `${JSON.stringify(meta, null, 2)}\n`,
    'utf8',
  );

  return frames;
};

type DedupedIssue = {
  key: string;
  reason: FitIssue['reason'];
  field: string;
  text: string;
  firstMs: number;
  lastMs: number;
  frameCount: number;
};

const dedupeSessionIssues = (frames: FrameMetrics[]): DedupedIssue[] => {
  const map = new Map<string, DedupedIssue>();
  for (const frame of frames) {
    for (const issue of frame.issues) {
      const field = issue.field || issue.id || issue.className || '(unnamed)';
      const key = `${issue.reason}|${field}|${issue.text}`;
      const existing = map.get(key);
      if (existing) {
        existing.lastMs = frame.timeMs;
        existing.frameCount += 1;
      } else {
        map.set(key, {
          key,
          reason: issue.reason,
          field,
          text: issue.text,
          firstMs: frame.timeMs,
          lastMs: frame.timeMs,
          frameCount: 1,
        });
      }
    }
  }
  return [...map.values()].sort((a, b) => a.firstMs - b.firstMs || a.field.localeCompare(b.field));
};

const writeReport = async (
  outputDir: string,
  sessions: Array<{
    size: string;
    sessionId: string;
    frames: FrameMetrics[];
  }>,
  spritesheetPaths: string[] = [],
) => {
  const lines: string[] = [
    '# DCO QA report',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Sessions: ${sessions.length}`,
    '',
    'DOM metrics only — secondary to visual review of spritesheets / frame PNGs.',
    'Issues are deduped across the timeline and only counted while the element is on-stage.',
    '',
  ];

  const sessionIssues = sessions.map((session) => ({
    ...session,
    issues: dedupeSessionIssues(session.frames),
  }));
  const failing = sessionIssues.filter((session) => session.issues.length > 0);

  lines.push('## Summary');
  lines.push('');
  lines.push(`- Sessions with on-stage DOM fit flags: **${failing.length}** / ${sessions.length}`);
  if (spritesheetPaths.length) {
    lines.push(`- Spritesheets: ${spritesheetPaths.map((item) => `\`${item}\``).join(', ')}`);
  }
  lines.push('');

  if (!failing.length) {
    lines.push('No on-stage clip/overflow flags from DOM metrics.');
    lines.push('');
  } else {
    lines.push('## DOM flags (deduped)');
    lines.push('');
    for (const session of failing) {
      lines.push(`### ${session.size} / ${session.sessionId}`);
      lines.push('');
      for (const issue of session.issues) {
        const span = issue.firstMs === issue.lastMs
          ? `t=${issue.firstMs}ms`
          : `t=${issue.firstMs}–${issue.lastMs}ms (${issue.frameCount} frames)`;
        lines.push(
          `- \`${issue.reason}\` **${issue.field}** ${JSON.stringify(issue.text)} — ${span}`,
        );
      }
      lines.push('');
    }
  }

  lines.push('## Visual review');
  lines.push('');
  lines.push('Primary review surface: `spritesheets/{variant}/{copy}/{size}.png` — full timeline per ad (folder per layout variant).');
  lines.push('In Cursor, invoke the **dco-qa-review** skill to inspect spritesheets/frames and write a visual findings report.');
  lines.push('');

  await fs.writeFile(path.resolve(outputDir, 'qa-report.md'), `${lines.join('\n')}\n`, 'utf8');
};

export const runCapture = async (options: CaptureOptions) => {
  const matrix = loadCopyMatrix();
  const workDir = options.workDir || DEFAULT_QA_WORK_DIR;
  const sizes = (options.filters?.sizes?.length ? options.filters.sizes : matrix.sizes)
    .filter((size) => matrix.sizes.includes(size));
  if (!sizes.length) throw new Error('No sizes selected');

  const matrixRows = expandMatrixRows(matrix, {
    variantIds: options.filters?.variantIds,
    copySetIds: options.filters?.copySetIds,
  });
  if (!matrixRows.length) throw new Error('No matrix rows selected');

  const timestamps = matrixFrameTimestamps(matrix);
  const concurrency = options.headed
    ? 1
    : Math.max(1, options.concurrency ?? defaultCaptureConcurrency());

  type Job = {
    size: string;
    matrixRow: MatrixRow;
    index: number;
  };

  const jobs: Job[] = [];
  for (const size of sizes) {
    for (const matrixRow of matrixRows) {
      jobs.push({ size, matrixRow, index: jobs.length });
    }
  }

  await fs.rm(options.outputDir, { recursive: true, force: true });
  await fs.mkdir(options.outputDir, { recursive: true });

  const metricsPath = path.resolve(options.outputDir, 'fit-metrics.jsonl');
  await fs.writeFile(metricsPath, '', 'utf8');

  let server: QaServer | null = null;
  let browser: Browser | null = null;
  const contexts: BrowserContext[] = [];
  const idlePages: Page[] = [];
  let completed = 0;
  let metricsWriteChain: Promise<void> = Promise.resolve();

  try {
    server = await startQaServer(workDir);
    browser = await chromium.launch({ headless: !options.headed });

    for (let i = 0; i < concurrency; i += 1) {
      const context = await browser.newContext({
        deviceScaleFactor: 1,
        reducedMotion: null,
      });
      contexts.push(context);
      idlePages.push(await context.newPage());
    }

    process.stdout.write(
      `Capturing ${jobs.length} sessions with concurrency ${concurrency}\n`,
    );

    const sessionSummaries = await mapPool(jobs, concurrency, async (job) => {
      const page = idlePages.pop();
      if (!page) throw new Error('No idle Playwright page available');

      const sessionDir = path.resolve(
        options.outputDir,
        job.size,
        job.matrixRow.sessionId,
      );
      await fs.mkdir(sessionDir, { recursive: true });

      try {
        const frames = await captureSession(page, {
          origin: server!.origin,
          size: job.size,
          matrix,
          matrixRow: job.matrixRow,
          sessionDir,
          timestamps,
          index: job.index,
        });

        completed += 1;
        process.stdout.write(
          `[${completed}/${jobs.length}] ${job.size} ${job.matrixRow.sessionId}\n`,
        );

        const metricLines: string[] = [];
        for (const frame of frames) {
          if (!frame.issues.length) continue;
          metricLines.push(JSON.stringify({
            size: job.size,
            sessionId: job.matrixRow.sessionId,
            variantId: job.matrixRow.variantId,
            copySetId: job.matrixRow.copySetId,
            timeMs: frame.timeMs,
            issues: frame.issues,
          }));
        }
        if (metricLines.length) {
          const chunk = `${metricLines.join('\n')}\n`;
          metricsWriteChain = metricsWriteChain.then(() => fs.appendFile(metricsPath, chunk, 'utf8'));
          await metricsWriteChain;
        }

        return {
          size: job.size,
          sessionId: job.matrixRow.sessionId,
          frames,
        };
      } finally {
        idlePages.push(page);
      }
    });

    process.stdout.write('Building spritesheets…\n');
    const sheets = await buildSpritesheets(options.outputDir, sizes);
    const spritesheetPaths = sheets.map((sheet) => sheet.path);

    await writeReport(options.outputDir, sessionSummaries, spritesheetPaths);

    process.stdout.write('Deriving hold samples from creative JSON…\n');
    const holdSamples = await writeHoldSamplesManifest({
      outputDir: options.outputDir,
      matrix,
      filters: options.filters,
      matrixRows,
    });
    process.stdout.write(`Hold samples: ${holdSamples.sessionCount} sessions → ${holdSamples.path}\n`);

    process.stdout.write('Building settled-hold spritesheets…\n');
    const settledSheets = await buildSettledSpritesheets(options.outputDir, {
      holdSamplesPath: holdSamples.path,
    });
    process.stdout.write(
      `Settled sheets: ${settledSheets.length} → ${path.join(options.outputDir, SETTLED_SHEETS_DIRNAME)}/\n`,
    );

    return {
      outputDir: options.outputDir,
      sessions: jobs.length,
      framesPerSession: timestamps.length,
      concurrency,
      spritesheets: spritesheetPaths,
      settledSheets: settledSheets.map((sheet) => sheet.path),
      issueSessions: sessionSummaries.filter((session) => (
        session.frames.some((frame) => frame.issues.length > 0)
      )).length,
    };
  } finally {
    await Promise.all(contexts.map((context) => context.close().catch(() => undefined)));
    await browser?.close().catch(() => undefined);
    await server?.close().catch(() => undefined);
  }
};
