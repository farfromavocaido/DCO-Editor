import path from 'node:path';

import { runCapture } from './capture';
import { DEFAULT_QA_WORK_DIR, exportCanonicalAgencyShell } from './export-shell';
import {
  archivePreviousQaRuns,
  defaultQaRunOutputDir,
  isManagedQaRunDir,
  pointQaLatestSymlink,
  QA_OUTPUT_ROOT,
} from './qa-paths';

type CliArgs = {
  sizes: string[];
  variants: string[];
  copies: string[];
  outputDir: string;
  workDir: string;
  skipExport: boolean;
  headed: boolean;
  /** False when `--output` overrides the default stamped path. */
  manageRunLayout: boolean;
  concurrency?: number;
};

const usage = () => {
  console.log(`Usage: npm run qa:dco -- [options]

Options:
  --size <size>         Limit to one size (repeatable). Example: 300x250
  --variant <id>        Limit to one layout variant (repeatable)
  --copy <id>           Limit to one copy set (repeatable)
  --output <dir>        Run output dir (default: qa-output/YYYYMMDD-HHMMSS/)
  --work-dir <dir>      Canonical-agency shell dir (default: .qa-work/)
  --concurrency <n>     Parallel capture pages (default: 12; 1 when --headed)
  -j <n>                Alias for --concurrency
  --skip-export         Reuse existing work-dir HTML
  --headed              Show the Chromium window
  --help                Show this help

Default layout: writes qa-output/<stamp>/, moves any older stamps into
qa-output/archive/ (relative links inside a run stay valid), and points
qa-output/latest → the new run.
`);
};

const parseArgs = (argv: string[]): CliArgs => {
  const args: CliArgs = {
    sizes: [],
    variants: [],
    copies: [],
    outputDir: defaultQaRunOutputDir(),
    workDir: DEFAULT_QA_WORK_DIR,
    skipExport: false,
    headed: false,
    manageRunLayout: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];
    if (token === '--help' || token === '-h') {
      usage();
      process.exit(0);
    }
    if (token === '--skip-export') {
      args.skipExport = true;
      continue;
    }
    if (token === '--headed') {
      args.headed = true;
      continue;
    }
    if ((token === '--concurrency' || token === '-j') && next) {
      const value = Number(next);
      if (!Number.isFinite(value) || value < 1) {
        throw new Error(`Invalid concurrency: ${next}`);
      }
      args.concurrency = Math.floor(value);
      i += 1;
      continue;
    }
    if (token === '--size' && next) {
      args.sizes.push(next);
      i += 1;
      continue;
    }
    if (token === '--variant' && next) {
      args.variants.push(next);
      i += 1;
      continue;
    }
    if (token === '--copy' && next) {
      args.copies.push(next);
      i += 1;
      continue;
    }
    if (token === '--output' && next) {
      args.outputDir = path.resolve(next);
      args.manageRunLayout = false;
      i += 1;
      continue;
    }
    if (token === '--work-dir' && next) {
      args.workDir = path.resolve(next);
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  return args;
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));

  if (!args.skipExport) {
    console.log('Exporting canonical-agency shell…');
    const exported = await exportCanonicalAgencyShell(args.workDir);
    console.log(`Shell ready: ${exported.entryCount} entries → ${exported.workDir}`);
  } else {
    console.log(`Skipping export; using ${args.workDir}`);
  }

  const runId = path.basename(args.outputDir);
  if (args.manageRunLayout && isManagedQaRunDir(args.outputDir)) {
    const archived = await archivePreviousQaRuns({ keepRunId: runId });
    if (archived.length) {
      console.log(`Archived prior run(s): ${archived.join(', ')} → ${path.join(QA_OUTPUT_ROOT, 'archive')}`);
    }
  }

  console.log('Capturing matrix…');
  const result = await runCapture({
    workDir: args.workDir,
    outputDir: args.outputDir,
    headed: args.headed,
    concurrency: args.concurrency,
    filters: {
      sizes: args.sizes.length ? args.sizes : undefined,
      variantIds: args.variants.length ? args.variants : undefined,
      copySetIds: args.copies.length ? args.copies : undefined,
    },
  });

  if (args.manageRunLayout && isManagedQaRunDir(result.outputDir)) {
    const latest = await pointQaLatestSymlink({ runId });
    console.log(`Latest: ${latest} → ${runId}`);
  }

  console.log('');
  console.log(`Done. Sessions: ${result.sessions} × ${result.framesPerSession} frames (concurrency ${result.concurrency})`);
  console.log(`Sessions with on-stage DOM flags: ${result.issueSessions}`);
  if (result.spritesheets?.length) {
    console.log(`Spritesheets: ${result.spritesheets.join(', ')}`);
  }
  console.log(`Output: ${result.outputDir}`);
  console.log(`Report: ${path.join(result.outputDir, 'qa-report.md')}`);
  console.log(`Hold samples: ${path.join(result.outputDir, 'hold-samples.json')}`);
  if (result.settledSheets?.length) {
    console.log(`Settled sheets: ${path.join(result.outputDir, 'settled')}/ (${result.settledSheets.length})`);
  }
  console.log(`Prior runs: ${path.join(QA_OUTPUT_ROOT, 'archive')}/`);
  console.log('');
  if (args.manageRunLayout && isManagedQaRunDir(result.outputDir)) {
    console.log(`Run the /dco-qa-review skill on ${runId} (aliased via qa-output/latest)`);
  } else {
    console.log(`Run the /dco-qa-review skill on ${result.outputDir}`);
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
