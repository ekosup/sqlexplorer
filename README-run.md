# SQLExplorer — Cara Menjalankan

## Development
```bash
npm install
npm run dev          # buka URL yang muncul (default http://localhost:5173)
```

## Build & mode offline
```bash
npm run build        # tsc --noEmit + vite build
```
Hasil di `dist/`. Buka `dist/index.html` (bisa dari `file://`, tanpa server).
Untuk distribusi kelas: zip folder `dist/`.

## Dataset contoh
File `public/datasets/sample-audit.sqlite` (data dummy anonim) sudah disertakan.
Isi: tabel `transaksi`, `buku_besar`, `karyawan`, `pemasok`, `pembelian` (sepanjang 2024),
plus red-flag sengaja: gap rekonsiliasi, transaksi duplikat, nilai outlier.

Regenerasi (butuh Node 22+):
```bash
node scripts/gen-sample-db.mjs
```

## Memakai aplikasi
1. Klik area drop / pilih file `.sqlite`/`.db` (mis. `sample-audit.sqlite`).
2. Panel Schema menampilkan daftar tabel + kolom.
3. Tulis query SELECT di editor → **Run** atau **Ctrl/Cmd+Enter**.
4. Panel Pembelajaran: pilih **Case Study** → scenario → ikuti arahan DB,
   baca **Explain**, lalu kerjakan **Individual Practice**. Atau pilih **Starter Query**.
5. **Export CSV** mengunduh hasil (UTF-8, kompatibel Excel).

## Catatan
- Mode belajar hanya menerima `SELECT` / `WITH` (read-only, FR-04).
- Semua data diproses di browser; tidak ada yang dikirim ke server.
- History hanya disimpan di memori sesi (tidak persist).
