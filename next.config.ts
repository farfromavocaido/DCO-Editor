import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  // Allow opening the editor via 127.0.0.1 (not just localhost) without
  // blocking webpack HMR / other Next.js dev resources.
  allowedDevOrigins: ['127.0.0.1'],
  typescript: { tsconfigPath: 'tsconfig.build.json' },
  serverExternalPackages: ['playwright', 'playwright-core', 'typescript'],
  turbopack: {
    root: path.join(__dirname),
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          '**/node_modules/**',
          '**/.next/**',
          '**/campaign/**',
          '**/output/**',
          '**/outputs/**',
          '**/qa-output/**',
          '**/site/**',
        ],
      };
    }
    return config;
  },
};

export default nextConfig;
