import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['qa-performance/__tests__/**/*.test.ts'],
    testTimeout: 60_000,
    setupFiles: ['qa-performance/__tests__/setup.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      // `server-only` no está instalado como dep aparte — Next la provee
      // en build. En Node (vitest) la aliaseamos a un stub vacío.
      'server-only': resolve(__dirname, 'qa-performance/__tests__/_stubs/server-only.ts'),
    },
  },
});
