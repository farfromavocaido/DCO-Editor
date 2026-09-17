import { defineConfig } from 'vitest/config';
import path from 'node:path';
import {exclusions} from './test-config/suites';

export default defineConfig({
  test: {
    environment: 'node',
    maxWorkers: 2,
    setupFiles: ['src/test/isolated-storage.ts'],
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    exclude: exclusions,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
