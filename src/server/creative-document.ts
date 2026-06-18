// @ts-nocheck
import fs from 'node:fs/promises';
import path from 'node:path';

import { creativeDocumentPath } from './paths';

export type CreativeDocument = Record<string, unknown>;

export const validateCreativeDocument = (document: CreativeDocument) => {
  if (!document || document.version !== 1) throw new Error('Creative document must be version 1');
  if (document.campaign?.id !== 'sse-dco') throw new Error('Creative document campaign id must be sse-dco');
  if (!document.clock?.durationS || !document.clock?.beats) throw new Error('Creative document requires clock data');
  if (!document.feed?.profileName || !Array.isArray(document.feed?.sampleRows)) {
    throw new Error('Creative document requires feed profile data');
  }
  if (!document.sizes || !Object.keys(document.sizes).length) throw new Error('Creative document requires sizes');
  for (const [size, sizeCreative] of Object.entries(document.sizes)) {
    if (!/^\d+x\d+$/.test(size)) throw new Error(`Bad size key: ${size}`);
    if (!sizeCreative.canvas?.width || !sizeCreative.canvas?.height) throw new Error(`Size ${size} is missing canvas`);
    if (!Array.isArray(sizeCreative.layers) || !sizeCreative.layers.length) throw new Error(`Size ${size} is missing layers`);
    for (const layer of sizeCreative.layers) {
      if (!layer.id || !layer.kind || !layer.base) throw new Error(`Size ${size} has an invalid layer`);
      if (!Array.isArray(layer.clips)) throw new Error(`Layer ${layer.id} clips must be an array`);
    }
  }
  return document;
};

export const readCreativeDocument = async (file = creativeDocumentPath) => {
  try {
    const raw = JSON.parse(await fs.readFile(file, 'utf8'));
    return validateCreativeDocument(raw);
  } catch (error) {
    if (error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(
        `Creative document not found at ${file}. Copy sse-dco-creative.json into campaign/.`,
      );
    }
    throw error;
  }
};

export const writeCreativeDocument = async (document: CreativeDocument, file = creativeDocumentPath) => {
  validateCreativeDocument(document);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(document, null, 2)}\n`);
  return readCreativeDocument(file);
};
