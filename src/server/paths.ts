import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = path.dirname(fileURLToPath(import.meta.url));

/** App root (repository root) */
export const appRoot = path.resolve(serverDir, '../..');

/** Campaign data: creative document, assets */
export const projectRoot = path.resolve(appRoot, 'campaign');

/** Generated HTML and export packages */
export const outputRoot = path.resolve(appRoot, 'output');

export const creativeDocumentPath = path.resolve(projectRoot, 'sse-dco-creative.json');
