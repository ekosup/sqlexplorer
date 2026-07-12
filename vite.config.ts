import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Drop legacy woff/ttf dari @font-face Tabler. Browser target (NFR-04: Chrome/Edge/Firefox)
// semua mendukung woff2 — menyisakan hanya woff2 menghemat ~3.6MB di paket offline.
// ponytail: regex strip saat transform, bukan vendoring manual; versi ikut npm.
const tablerWoff2Only = (): Plugin => ({
  name: 'tabler-woff2-only',
  enforce: 'pre',
  transform(code, id) {
    if (!id.includes('tabler-icons') || !id.endsWith('.css')) return null;
    const fixed = code
      .replace(/,\s*url\([^)]*?\.woff\?[^)]*?\)\s*format\("woff"\)/g, '')
      .replace(/,\s*url\([^)]*?\.ttf[^)]*?\)\s*format\("truetype"\)/g, '');
    return { code: fixed, map: null };
  },
});

// base './' agar bisa dibuka dari file:// (NFR-01 offline).
export default defineConfig({
  base: './',
  worker: { format: 'es' },
  plugins: [
    tablerWoff2Only(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'inline',
      manifest: {
        name: 'SQLExplorer — Belajar SQL Audit',
        short_name: 'SQLExplorer',
        description: 'SQL Explorer berbasis browser untuk belajar SQL audit akuntansi',
        theme_color: '#2563eb',
        background_color: '#f1f5f9',
        display: 'standalone',
        orientation: 'portrait-primary',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icons/icon-192-maskable.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,wasm,woff2,sqlite,png}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB limit for WASM and local DB datasets
      }
    })
  ],
  build: { target: 'es2022', assetsInlineLimit: 0 },
});
