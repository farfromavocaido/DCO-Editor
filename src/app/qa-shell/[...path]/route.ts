import fs from 'node:fs/promises';
import path from 'node:path';

import { ensureCanonicalAgencyShell, DEFAULT_QA_WORK_DIR } from '@/server/qa-agency-shell';
import { errorResponse, safeJoin } from '@/server/http';
import { projectRoot } from '@/server/paths';

export const runtime = 'nodejs';

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
  '.otf': 'font/otf',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

type Params = { params: Promise<{ path: string[] }> };

const resolveQaShellFile = async (parts: string[]) => {
  await ensureCanonicalAgencyShell();
  const joined = parts.map((part) => decodeURIComponent(part)).join('/');

  // `/qa-shell/assets/…` → campaign/assets (same alias as capture server)
  if (joined === 'assets' || joined.startsWith('assets/')) {
    const relative = joined.replace(/^assets\/?/, '');
    return safeJoin(path.resolve(projectRoot, 'assets'), relative || '.');
  }

  return safeJoin(DEFAULT_QA_WORK_DIR, joined);
};

export async function GET(_request: Request, { params }: Params) {
  try {
    const { path: parts } = await params;
    if (!parts?.length) {
      return errorResponse(new Error('Missing path'), 404);
    }
    const filePath = await resolveQaShellFile(parts);
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      return errorResponse(new Error('Not found'), 404);
    }
    const ext = path.extname(filePath).toLowerCase();
    const body = await fs.readFile(filePath);
    return new Response(body, {
      status: 200,
      headers: {
        'content-type': MIME[ext] || 'application/octet-stream',
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('path escapes') || message.includes('ENOENT')) {
      return errorResponse(new Error('Not found'), 404);
    }
    return errorResponse(error);
  }
}
