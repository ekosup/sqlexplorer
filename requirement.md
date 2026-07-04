# SQLExplorer — Requirement (Refined)

**Versi:** 0.3  
**Tanggal:** 4 Juli 2026  
**Status:** Baseline siap implementasi (TypeScript)

---

## 1) Tujuan Produk

Membangun **SQL Explorer berbasis browser (client-side only)** untuk mahasiswa belajar SQL audit akuntansi, dengan fokus:

1. **Zero-install**: cukup buka `index.html`, pilih file `.sqlite`, langsung query.
2. **Reliable untuk kelas**: minim error teknis, pesan error mudah dipahami pemula.
3. **Relevan kurikulum**: ada starter query bertema audit.
4. **Case-study driven learning**: dosen bisa update materi lewat JSON tanpa ubah kode.

### Non-Tujuan (v1)
- Bukan DB admin tool (user management, backup/restore server, dsb).
- Bukan collaborative editor.
- Bukan multi-engine DB (hanya SQLite).
- Bukan tool untuk data produksi sensitif.

---

## 2) Persona & Use Case Utama

### Persona
- **Mahasiswa D3/D4 Akuntansi/Audit**: pemula SQL, butuh praktik cepat tanpa setup rumit.
- **Dosen/Pengajar**: menyiapkan dataset + case study + starter query per topik.

### Use case inti
1. Mahasiswa buka aplikasi offline.
2. Mahasiswa memilih **case study**.
3. Sistem menampilkan skenario, query, dan explanation dari case study.
4. Mahasiswa memuat file `.sqlite` yang sesuai (sesuai arahan case study).
5. Mahasiswa menjalankan query contoh / query sendiri.
6. Mahasiswa interpretasi hasil dan latihan mandiri.

---

## 3) Keputusan Teknis Inti (Disepakati)

1. **Arsitektur:** static web app, 100% client-side.
2. **Engine SQL:** `sql.js` (WASM SQLite).
3. **UI stack:** TypeScript + Vite + vanilla DOM.
4. **Editor:** CodeMirror 6 (SQL highlighting).
5. **Load DB:** hanya via file picker / drag-drop (bukan `fetch()` lokal).
6. **Mode eksekusi:** **read-only untuk v1** (hanya query SELECT/CTE).
7. **Konten belajar:** file JSON lokal (`caseStudies.json`, `starterQueries.json`) agar mudah di-update dosen.

> Alasan read-only: paling aman untuk kelas, mencegah file contoh rusak.

---

## 4) Scope Fitur

## 4.1 In Scope (v1)
- Load file `.sqlite/.db` via picker & drag-drop.
- Schema browser: daftar tabel + kolom + tipe data.
- Query editor + shortcut `Ctrl/Cmd + Enter`.
- Result grid + metadata (jumlah baris, durasi query).
- Export hasil ke CSV.
- Error message ramah pemula.
- Query history per sesi.
- Starter query library bertema audit.
- **Case Study Library** dari JSON (pilih studi kasus, lihat skenario, load query, baca explanation).

## 4.2 Out of Scope (v1)
- INSERT/UPDATE/DELETE/DDL.
- Multi-tab session.
- Persist history lintas sesi.
- Charting/visualisasi.
- Auth/login.
- Auto-grading jawaban SQL mahasiswa.

---

## 5) Functional Requirements (Prioritas)

## P0 — Wajib untuk rilis kelas

### FR-01 Load Database
- User dapat memilih file `.sqlite/.db` via file picker.
- User dapat drag-and-drop file.
- Sistem memvalidasi file SQLite; jika gagal tampilkan error jelas.
- Setelah sukses, tampilkan nama file + ukuran.

### FR-02 Schema Browser
- Sistem menampilkan daftar tabel.
- Klik tabel menampilkan kolom + tipe data.
- Tampilkan row count (boleh lazy-loaded per tabel).

### FR-03 Query Execution
- Editor SQL dengan syntax highlight.
- Tombol `Run Query` dan shortcut keyboard.
- Eksekusi query menampilkan hasil tabular.
- Tampilkan `execution time` dan `row count`.

### FR-04 Read-only Guard
- Query non-SELECT ditolak sebelum dieksekusi.
- Pesan: “Mode belajar saat ini hanya mendukung SELECT/CTE.”

### FR-05 Error Handling
- Error SQL dipetakan ke bahasa yang lebih sederhana.
- Minimal mapping untuk kasus umum:
  - `no such table`
  - `no such column`
  - syntax error dekat token tertentu

### FR-06 Export CSV
- Hasil query dapat diunduh sebagai CSV UTF-8.
- Header kolom wajib ikut.

### FR-07 Case Study Library (JSON-driven)
- Sistem membaca daftar case study dari file JSON lokal.
- Mahasiswa dapat memilih 1 case study dari list.
- Setelah dipilih, sistem menampilkan:
  - `title`
  - `description`
  - daftar `scenario[]`
  - `query`
  - `explanation`

### FR-08 Case Study Scenario Flow
- Setiap scenario menampilkan arahan dataset/DB yang benar.
- Mahasiswa dapat memilih scenario dalam case study.
- Sistem memuat query bawaan scenario ke editor (atau query default case study).
- Sistem menampilkan panel “explain + individual practice” per scenario.

## P1 — Penting, tapi bisa menyusul jika mepet

### FR-09 Query History (session only)
- Menyimpan daftar query yang berhasil dijalankan pada sesi aktif.
- Klik item history mengisi ulang editor.

### FR-10 Starter Query Library
- Daftar query contoh per topik audit.
- Tiap item: judul, tujuan belajar singkat, tombol “Load to editor”.

---

## 6) Non-Functional Requirements (Reliability-Focused)

### NFR-01 Offline & Portability
- Aplikasi berjalan dari `file://` tanpa server lokal.
- Tidak ada dependency CDN saat runtime.

### NFR-02 Reliability
- Query dieksekusi di **Web Worker** untuk mencegah UI freeze.
- Jika query gagal, aplikasi tetap usable (tidak reload total).
- Penanganan error tidak boleh memunculkan stack trace teknis sebagai pesan utama ke mahasiswa.

### NFR-03 Performance
- Target database: hingga 50MB untuk praktikum standar.
- Query sederhana (SELECT + filter dasar) respons < 3 detik pada laptop kelas menengah.
- Result grid harus membatasi render awal (pagination atau row windowing).

### NFR-04 Compatibility
- Target utama: Chrome/Edge versi modern.
- Firefox best-effort.

### NFR-05 Security & Privacy
- Tidak ada data dikirim ke jaringan.
- Tidak ada telemetry default.
- History hanya di memory sesi (v1).

### NFR-06 Accessibility & UX belajar
- UI default Bahasa Indonesia.
- Komponen utama dapat dioperasikan keyboard.
- Kontras warna minimum layak baca (WCAG AA untuk teks utama).

### NFR-07 Content Updatability
- Dosen dapat update case study cukup dengan mengganti file JSON + dataset terkait.
- Struktur JSON tervalidasi saat startup; jika invalid, tampilkan error konten yang jelas.

---

## 7) Data & Konten Pembelajaran

## 7.1 Starter dataset
- Dosen menyediakan minimal 1 file `sample-audit.sqlite` berisi data dummy realistis.
- Dataset wajib anonim (tanpa data pribadi nyata).

## 7.2 Starter query audit (baseline)
1. Rekonsiliasi transaksi vs buku besar (JOIN).
2. Deteksi duplikasi (`GROUP BY ... HAVING COUNT(*) > 1`).
3. Deteksi nilai/frekuensi tidak wajar (aggregasi + HAVING).
4. Sampling audit (`ORDER BY RANDOM() LIMIT n`).
5. Tren periodik per bulan/kuartal.

## 7.3 Format Case Study JSON (wajib)
`caseStudies.json` berisi array case study. Minimal field:

```json
[
  {
    "id": "cs-rekonsiliasi-01",
    "title": "Rekonsiliasi Penjualan vs Buku Besar",
    "description": "Mahasiswa membandingkan total transaksi dan jurnal.",
    "scenario": [
      {
        "id": "scn-1",
        "title": "Cari selisih per bulan",
        "db": "sample-audit.sqlite",
        "query": "SELECT ...",
        "explanation": "Bandingkan total transaksi vs GL; selisih besar = red flag.",
        "practice": "Modifikasi query untuk hanya cabang Jakarta"
      }
    ],
    "query": "SELECT ...",
    "explanation": "Query baseline untuk mengenalkan rekonsiliasi."
  }
]
```

Keterangan:
- `title`, `description`, `scenario[]`, `query`, `explanation` = **minimal wajib**.
- `scenario[]` bisa lebih dari satu untuk variasi pembelajaran.
- `db` pada scenario dipakai sebagai petunjuk file DB yang harus dipilih mahasiswa.

---

## 8) Arsitektur Folder (Target)

```txt
sqlexplorer/
├── src/
│   ├── main.ts
│   ├── worker/
│   │   └── sql.worker.ts
│   ├── db/
│   │   ├── engine.ts
│   │   └── schema.ts
│   ├── editor/
│   │   └── queryEditor.ts
│   ├── ui/
│   │   ├── fileLoader.ts
│   │   ├── schemaBrowser.ts
│   │   ├── resultGrid.ts
│   │   ├── historyPanel.ts
│   │   ├── starterQueryPanel.ts
│   │   └── caseStudyPanel.ts
│   └── data/
│       ├── starterQueries.json
│       └── caseStudies.json
├── public/
│   └── datasets/
│       └── sample-audit.sqlite
├── index.html
├── vite.config.ts
└── package.json
```

---

## 9) Acceptance Criteria (Definition of Done v1)

Rilis dinyatakan siap dipakai kelas jika semua poin ini lulus:

1. Buka `index.html` di mode offline, aplikasi tetap berfungsi.
2. Load database sukses via picker **dan** drag-drop.
3. Schema tabel dan kolom tampil benar.
4. Query SELECT bisa dijalankan, hasil tampil benar.
5. Query non-SELECT ditolak dengan pesan read-only.
6. Error SQL umum tampil dalam Bahasa Indonesia yang mudah dipahami.
7. Export CSV berjalan dan file dapat dibuka di Excel.
8. Tidak ada crash aplikasi setelah 20 eksekusi query campuran (valid + invalid).
9. Mahasiswa dapat pilih case study, pilih scenario, mengikuti arahan DB, menjalankan query, lalu membaca explanation dan instruksi practice.

---

## 10) Test Plan Minimum (Ringkas)

- **Smoke test:** load DB, run query, export CSV.
- **Negative test:** file bukan SQLite, query salah sintaks, query non-SELECT.
- **Stability test:** jalankan 20 query berurutan, pastikan UI tetap responsif.
- **Offline test:** putus internet, ulangi smoke test.
- **Browser test:** Chrome + Edge.
- **Case-study test:** validasi `caseStudies.json`, pilih 2 scenario berbeda, pastikan flow DB+explain+practice berjalan.

---

## 11) Roadmap Sederhana

- **MVP (P0):** FR-01 s/d FR-08.
- **v1.1:** FR-09, FR-10 + penyempurnaan pesan error.
- **v2 (opsional):** dark mode, latihan dengan checker jawaban, multi-dataset pack.

---

## 12) Catatan Implementasi (Praktis)

- Gunakan strict TypeScript dari awal (`"strict": true`).
- Simpan starter query + case study di JSON agar dosen bisa update tanpa ubah kode inti.
- Hindari framework UI besar untuk menjaga bundle kecil dan maintenance ringan.
- `ponytail:` v1 cukup validasi schema JSON ringan (manual check field wajib), tambah JSON Schema formal hanya jika konten mulai sering error.
