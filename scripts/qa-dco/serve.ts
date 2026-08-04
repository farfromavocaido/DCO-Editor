import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { appRoot, projectRoot } from '../../src/server/paths';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

export type QaServer = {
  port: number;
  origin: string;
  close: () => Promise<void>;
};

const resolveFile = (workDir: string, urlPath: string) => {
  const decoded = decodeURIComponent(urlPath.split('?')[0] || '/');
  const normalized = path.posix.normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, '');

  if (normalized === '/assets' || normalized.startsWith('/assets/')) {
    const relative = normalized.replace(/^\/assets\/?/, '');
    return path.resolve(projectRoot, 'assets', relative);
  }

  const relative = normalized.replace(/^\//, '');
  return path.resolve(workDir, relative || 'index.html');
};

/**
 * Serve canonical-agency workdir at `/` and campaign assets at `/assets/…`.
 */
export const startQaServer = async (
  workDir: string,
  port = 0,
): Promise<QaServer> => {
  const server = http.createServer((req, res) => {
    try {
      const urlPath = req.url || '/';
      const filePath = resolveFile(workDir, urlPath);
      const workResolved = path.resolve(workDir);
      const assetsResolved = path.resolve(projectRoot, 'assets');
      const allowed = filePath.startsWith(workResolved + path.sep)
        || filePath === workResolved
        || filePath.startsWith(assetsResolved + path.sep)
        || filePath === assetsResolved;
      if (!allowed) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      fs.createReadStream(filePath).pipe(res);
    } catch (error) {
      res.writeHead(500);
      res.end(error instanceof Error ? error.message : 'Server error');
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind QA static server');
  }

  return {
    port: address.port,
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    }),
  };
};

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  const workDir = path.resolve(appRoot, process.argv[2] || '.qa-work');
  startQaServer(workDir, Number(process.argv[3]) || 4174)
    .then((server) => {
      console.log(`QA server: ${server.origin}`);
      console.log(`Workdir: ${workDir}`);
      console.log(`Assets: ${path.resolve(projectRoot, 'assets')}`);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
