import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
    coverage: { provider: 'v8' },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
