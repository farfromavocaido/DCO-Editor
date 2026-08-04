import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_QA_WORK_DIR,
  exportCanonicalAgencyShell,
} from '../../src/server/qa-agency-shell';

export { DEFAULT_QA_WORK_DIR, exportCanonicalAgencyShell };

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  exportCanonicalAgencyShell()
    .then((result) => {
      console.log(`Canonical agency shell → ${result.workDir}`);
      console.log(`Sizes: ${result.sizes.join(', ')} (${result.entryCount} entries)`);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
