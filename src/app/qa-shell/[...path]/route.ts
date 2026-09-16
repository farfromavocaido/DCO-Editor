import fs from 'node:fs/promises';
import path from 'node:path';

import { ensureCanonicalAgencyShell, qaRevisionDirectory } from '@/server/qa-agency-shell';
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
  const joined = parts.map((part) => decodeURIComponent(part)).join('/');

  // `/qa-shell/assets/…` → campaign/assets (same alias as capture server)
  if (joined === 'assets' || joined.startsWith('assets/')) {
    const relative = joined.replace(/^assets\/?/, '');
    return safeJoin(path.resolve(projectRoot, 'assets'), relative || '.');
  }

  if (parts[0] === 'revisions' && parts[1]) {
    const relative = parts.slice(2).join('/');
    if (relative.startsWith('.')) throw new Error('ENOENT');
    return safeJoin(qaRevisionDirectory(parts[1]), relative);
  }
  const info = await ensureCanonicalAgencyShell();
  return safeJoin(info.workDir, joined);
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
