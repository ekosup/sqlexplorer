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

## Persistensi (data yang disimpan di browser)
- **Database** yang dimuat disimpan di IndexedDB → **selamat dari refresh / tutup tab**.
  Hilang hanya lewat tombol **🗑 Clear DB** (di sidebar Schema) atau meng-upload file baru.
- **History query** disimpan di `localStorage` (maks 30, dedup berurutan) → selamat dari refresh.
- **Audit Log** (tombol **Audit Log** di header): setiap query yang dijalankan (sukses maupun error)
  dicatat sebagai flat text (SQL + hasil TSV + nama DB aktif + waktu + ms). Berguna agar peserta
  tetap bisa mereview hasil query meski DB sudah ditukar. Bisa di-export menjadi satu file `.txt`.
  Tersimpan di IndexedDB, maks 200 entry (auto-trim) & 200 baris per entry.

## Hosting ke GitHub Pages
Repo sudah punya workflow (`.github/workflows/deploy.yml`) yang otomatis build & deploy
`dist/` ke GitHub Pages setiap push ke `main`.

Setup sekali:
1. Push repo ke GitHub.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push ke `main` memicu deploy. URL: `https://<user>.github.io/sqlexplorer/`.

`base: './'` (relatif) + worker via `import.meta.url` → aman dari subpath.

## Catatan
- Mode belajar hanya menerima `SELECT` / `WITH` (read-only, FR-04).
- Semua data diproses di browser; tidak ada yang dikirim ke server.
