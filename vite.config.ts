import { defineConfig } from 'vite';

// base './' agar bisa dibuka dari file:// (NFR-01 offline).
export default defineConfig({
  base: './',
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
  },
});
