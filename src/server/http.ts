import fs from 'node:fs/promises';
import path from 'node:path';

import { projectRoot } from '@/server/paths';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.otf': 'font/otf',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

export const safeJoin = (root: string, requestPath: string) => {
  const resolved = path.resolve(root, requestPath.replace(/^\/+/, ''));
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error('path escapes root');
  }
  return resolved;
};

export async function serveAsset(relativePath: string) {
  const file = safeJoin(projectRoot, relativePath);
  const stat = await fs.stat(file);
  if (!stat.isFile()) throw new Error('not a file');
  const ext = path.extname(file).toLowerCase();
  const body = await fs.readFile(file);
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': MIME[ext] || 'application/octet-stream',
      'cache-control': 'no-store',
    },
  });
}

export function jsonResponse(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

export function errorResponse(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : String(error);
  return jsonResponse({ error: message }, status);
}
