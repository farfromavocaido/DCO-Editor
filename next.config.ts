import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  // Allow opening the editor via 127.0.0.1 (not just localhost) without
  // blocking webpack HMR / other Next.js dev resources.
  allowedDevOrigins: ['127.0.0.1'],
  serverExternalPackages: [],
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
