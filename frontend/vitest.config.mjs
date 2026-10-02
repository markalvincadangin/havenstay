import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react({
      include: /\.(jsx|js|tsx|ts)$/,
    }),
  ],
  esbuild: {
    loader: 'jsx',
    include: /\.(jsx|js|tsx|ts)$/,
    exclude: [],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.js'],
    include: ['__tests__/**/*.test.{js,jsx}'],
    clearMocks: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
