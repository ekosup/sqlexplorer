import { defineConfig, type Plugin } from 'vite';

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
  plugins: [tablerWoff2Only()],
  build: { target: 'es2022', assetsInlineLimit: 0 },
});
