import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  holdSamplesForSession,
  type HoldSamplesManifest,
} from '../../src/lib/hold-samples';
import { readCreativeDocumentForCampaign } from '../../src/server/creative-document';
import {
  captureIntervalMs,
  expandMatrixRows,
  loadCopyMatrix,
  type CopyMatrix,
  type MatrixRow,
} from './build-rows';
import { defaultQaRunOutputDir } from './qa-paths';

const DCO_CAMPAIGN_ID = 'sse-dco';

export const HOLD_SAMPLES_FILENAME = 'hold-samples.json';

export type HoldSampleFilters = {
  sizes?: string[];
  variantIds?: string[];
  copySetIds?: string[];
};

export type EmitHoldSamplesOptions = {
  outputDir: string;
  matrix?: CopyMatrix;
  document?: Record<string, unknown>;
  filters?: HoldSampleFilters;
  matrixRows?: MatrixRow[];
};

export const buildHoldSamplesManifest = async (
  options: {
    matrix?: CopyMatrix;
    document?: Record<string, unknown>;
    filters?: HoldSampleFilters;
    matrixRows?: MatrixRow[];
  } = {},
): Promise<HoldSamplesManifest> => {
  const matrix = options.matrix || loadCopyMatrix();
  const document = options.document
    || await readCreativeDocumentForCampaign(DCO_CAMPAIGN_ID) as Record<string, unknown>;
  const intervalMs = captureIntervalMs(matrix);
  const sizes = options.filters?.sizes?.length
    ? matrix.sizes.filter((size) => options.filters!.sizes!.includes(size))
    : matrix.sizes;
  const rows = options.matrixRows || expandMatrixRows(matrix, {
    variantIds: options.filters?.variantIds,
    copySetIds: options.filters?.copySetIds,
  });

  const bySession: HoldSamplesManifest['bySession'] = {};
  for (const matrixRow of rows) {
    bySession[matrixRow.sessionId] = holdSamplesForSession(document, {
      variantId: matrixRow.variantId,
      copySetId: matrixRow.copySetId,
      row: matrixRow.row,
      sizes,
      intervalMs,
    });
  }

  return {
    durationS: matrix.durationS,
    intervalMs,
    bySession,
  };
};

export const writeHoldSamplesManifest = async (
  options: EmitHoldSamplesOptions,
): Promise<{ path: string; sessionCount: number }> => {
  const manifest = await buildHoldSamplesManifest(options);
  const outPath = path.resolve(options.outputDir, HOLD_SAMPLES_FILENAME);
  await fs.mkdir(options.outputDir, { recursive: true });
  await fs.writeFile(outPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return { path: outPath, sessionCount: Object.keys(manifest.bySession).length };
};

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const parseOutput = () => {
    const argv = process.argv.slice(2);
    let outputDir = defaultQaRunOutputDir();
    for (let i = 0; i < argv.length; i += 1) {
      if (argv[i] === '--output' && argv[i + 1]) {
        outputDir = path.resolve(argv[i + 1]!);
        i += 1;
      }
    }
    return outputDir;
  };

  writeHoldSamplesManifest({ outputDir: parseOutput() })
    .then((result) => {
      console.log(`Wrote ${result.sessionCount} sessions → ${result.path}`);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.stack || error.message : error);
      process.exitCode = 1;
    });
}
