import { defineConfig } from 'vitest/config';
import path from 'node:path';

// These checks describe campaign art direction. Review/update them when the
// approved creative changes; they do not gate the editor's engine test suite.
export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['src/test/isolated-storage.ts'],
    include: ['src/**/*.creative.test.ts'],
  },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
});
