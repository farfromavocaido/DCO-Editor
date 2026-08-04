import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { writeHoldSamplesManifest, HOLD_SAMPLES_FILENAME } from './hold-samples';
import { defaultQaRunOutputDir } from './qa-paths';
import { buildSettledSpritesheets, SETTLED_SHEETS_DIRNAME } from './spritesheet';
import fs from 'node:fs/promises';

const parseOutput = (argv: string[]) => {
  let outputDir = defaultQaRunOutputDir();
  let ensureHolds = true;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--output' && argv[i + 1]) {
      outputDir = path.resolve(argv[i + 1]!);
      i += 1;
      continue;
    }
    if (argv[i] === '--skip-holds') {
      ensureHolds = false;
    }
  }
  return { outputDir, ensureHolds };
};

export const emitSettledSpritesheets = async (outputDir: string, ensureHolds = true) => {
  const holdPath = path.resolve(outputDir, HOLD_SAMPLES_FILENAME);
  if (ensureHolds) {
    try {
      await fs.access(holdPath);
    } catch {
      await writeHoldSamplesManifest({ outputDir });
    }
  }
  return buildSettledSpritesheets(outputDir, { holdSamplesPath: holdPath });
};

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const { outputDir, ensureHolds } = parseOutput(process.argv.slice(2));
  emitSettledSpritesheets(outputDir, ensureHolds)
    .then((sheets) => {
      console.log(`Wrote ${sheets.length} settled sheets → ${path.join(outputDir, SETTLED_SHEETS_DIRNAME)}/`);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.stack || error.message : error);
      process.exitCode = 1;
    });
}
