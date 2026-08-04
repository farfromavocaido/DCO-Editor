import fs from 'node:fs/promises';
import path from 'node:path';

import { appRoot } from '../../src/server/paths';

/** Parent for all capture runs (gitignored). */
export const QA_OUTPUT_ROOT = path.resolve(appRoot, 'qa-output');

/** Previous runs live here so only the newest stamp sits at `qa-output/` root. */
export const QA_ARCHIVE_DIRNAME = 'archive';

/** Stable symlink name → current run folder (relative target). */
export const QA_LATEST_SYMLINK = 'latest';

/** `YYYYMMDD-HHMMSS` */
export const QA_RUN_ID_RE = /^\d{8}-\d{6}$/;

/**
 * Local wall-clock run id: `YYYYMMDD-HHMMSS` (no timezone suffix).
 * Example: `20260731-170122`.
 */
export function formatQaRunId(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

/** Default run directory: `qa-output/<YYYYMMDD-HHMMSS>/`. */
export function defaultQaRunOutputDir(date = new Date()): string {
  return path.join(QA_OUTPUT_ROOT, formatQaRunId(date));
}

export function qaArchiveDir(outputRoot = QA_OUTPUT_ROOT): string {
  return path.join(outputRoot, QA_ARCHIVE_DIRNAME);
}

export function isQaRunId(name: string): boolean {
  return QA_RUN_ID_RE.test(name);
}

/**
 * Move every timestamped run folder at `outputRoot` (except `keepRunId`) into
 * `outputRoot/archive/`. Whole-folder moves keep relative links in
 * `visual-review.md` / spritesheets intact.
 */
export async function archivePreviousQaRuns(options: {
  keepRunId: string;
  outputRoot?: string;
}): Promise<string[]> {
  const outputRoot = options.outputRoot ?? QA_OUTPUT_ROOT;
  const archiveRoot = qaArchiveDir(outputRoot);
  await fs.mkdir(outputRoot, { recursive: true });

  let entries: string[];
  try {
    entries = await fs.readdir(outputRoot);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }

  const moved: string[] = [];
  for (const name of entries) {
    if (!isQaRunId(name) || name === options.keepRunId) continue;
    const from = path.join(outputRoot, name);
    const stat = await fs.lstat(from);
    if (!stat.isDirectory() || stat.isSymbolicLink()) continue;

    await fs.mkdir(archiveRoot, { recursive: true });
    const to = path.join(archiveRoot, name);
    await fs.rm(to, { recursive: true, force: true });
    await fs.rename(from, to);
    moved.push(name);
  }
  return moved;
}

/**
 * Point `outputRoot/latest` at `./<runId>` (relative symlink). Safe to call after
 * the run directory exists.
 */
export async function pointQaLatestSymlink(options: {
  runId: string;
  outputRoot?: string;
}): Promise<string> {
  const outputRoot = options.outputRoot ?? QA_OUTPUT_ROOT;
  const linkPath = path.join(outputRoot, QA_LATEST_SYMLINK);
  await fs.mkdir(outputRoot, { recursive: true });
  await fs.rm(linkPath, { force: true });
  await fs.symlink(options.runId, linkPath);
  return linkPath;
}

/** True when `dir` is a direct child run folder of `qa-output/` (not archive). */
export function isManagedQaRunDir(dir: string, outputRoot = QA_OUTPUT_ROOT): boolean {
  const resolved = path.resolve(dir);
  const root = path.resolve(outputRoot);
  if (path.dirname(resolved) !== root) return false;
  return isQaRunId(path.basename(resolved));
}
