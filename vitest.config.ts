import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['src/test/isolated-storage.ts'],
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    exclude: ['**/*.creative.test.ts', '**/node_modules/**', '**/.worktrees/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
