import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      'node-simctl': path.resolve(__dirname, './test/mocks/node-simctl.ts'),
      'webdriverio': path.resolve(__dirname, './test/mocks/webdriverio.ts'),
    },
  },
  test: {
    globals: true,
    include: ['src/**/*.test.ts', 'test/**/*.test.ts', 'test/**/*.eval.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    setupFiles: ['./test/setup.ts'],
  },
});
