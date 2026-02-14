import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.spec.ts', 'src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/generated/**'],
    },
  },
  resolve: {
    alias: {
      '@connection': resolve(__dirname, 'src/connection'),
      '@messaging': resolve(__dirname, 'src/messaging'),
      '@transport': resolve(__dirname, 'src/transport'),
      '@shared': resolve(__dirname, 'src/shared'),
      '@config': resolve(__dirname, 'src/config'),
      '@generated': resolve(__dirname, 'src/generated'),
    },
  },
});
