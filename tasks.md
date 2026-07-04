# TASKS — SQLExplorer (TypeScript)

Status: Draft eksekusi dari `requirement.md` v0.3

---

## 0) Tambahan Requirement UI/UX (Fokus Belajar Audit dengan SQL)

### UXR-A1 — Learning Objective per Query
- Setiap starter query wajib punya metadata:
  - `konsep_audit`
  - `tujuan_belajar`
  - `apa_yang_dicek`

### UXR-A2 — Explain Panel (Bahasa sederhana)
- Setelah query dijalankan, tampil panel ringkas:
  - “Query ini mencari apa?”
  - “Output ini dibaca bagaimana?”
  - “Red flag audit apa yang mungkin muncul?”

### UXR-A3 — Guided Practice Mode (ringan)
- Untuk tiap topik, sediakan:
  - instruksi langkah singkat
  - template query setengah jadi
  - tombol hint bertahap
- `ponytail:` v1 tanpa auto-grading.

### UXR-A4 — Glossary mini
- Tooltip istilah audit + SQL (1–2 kalimat).

### UXR-A5 — Anti-overwhelm UI
- 3 panel inti: Schema | Editor+Result | Learning.
- Elemen advanced default collapse.

### UXR-A6 — Case Study Library (JSON-driven)
- Dosen dapat menambah/mengubah studi kasus via `caseStudies.json`.
- Minimal field per case study:
  - `title`, `description`, `scenario[]`, `query`, `explanation`
- Tiap `scenario[]` dapat punya DB target + practice mandiri.
- Flow mahasiswa: pilih case study → pilih scenario → load DB sesuai arahan → jalankan query → baca explain → kerjakan practice.

Acceptance tambahan UI/UX:
- Mahasiswa baru bisa menyelesaikan 1 skenario dari case study tanpa bantuan dosen >5 menit.

---

## 1) Milestone

- **M1 (Core engine + read-only explorer)**
- **M2 (Learning UX + Case Study flow)**
- **M3 (Hardening + classroom readiness)**

---

## 2) Task Breakdown

## M1 — Core Engine + Explorer (P0)

### T1. Bootstrap project
- [ ] Init Vite + TypeScript strict
- [ ] Setup struktur folder sesuai requirement
- [ ] Setup lint + format minimal
- DoD: `npm run build` sukses, app render halaman dasar.

### T2. SQL engine worker
- [ ] Integrasi `sql.js` di Web Worker
- [ ] API worker: `loadDb`, `execQuery`, `getSchema`
- [ ] Handle error serialization worker -> main thread
- DoD: query sederhana jalan tanpa freeze UI.

### T3. File loader
- [ ] File picker `.sqlite/.db`
- [ ] Drag-drop area
- [ ] Validasi file + error message Indonesia
- [ ] Tampilkan nama file + ukuran
- DoD: 2 jalur load (picker + drop) lulus smoke test.

### T4. Read-only guard
- [ ] Blok keyword non-SELECT/CTE
- [ ] Tampilkan pesan edukatif saat ditolak
- DoD: query write tidak pernah dikirim ke engine.

### T5. Schema browser
- [ ] List tabel
- [ ] Detail kolom + tipe data saat klik tabel
- [ ] Row count lazy-load
- DoD: schema tampil akurat pada sample DB.

### T6. Query editor + run
- [ ] Integrasi CodeMirror SQL
- [ ] Tombol Run + shortcut Ctrl/Cmd+Enter
- [ ] Render result grid + metadata (durasi, row count)
- DoD: minimal 5 query SELECT bisa dieksekusi berurutan.

### T7. CSV export
- [ ] Export hasil query ke CSV UTF-8
- [ ] Sertakan header kolom
- DoD: CSV terbaca normal di Excel.

### T8. Error mapping dasar
- [ ] Map `no such table`
- [ ] Map `no such column`
- [ ] Map syntax error token
- DoD: pesan mahasiswa-friendly jadi pesan utama.

---

## M2 — Learning UX + Case Study (P0/P1)

### T9. Starter query library v1
- [ ] Buat `starterQueries.json` + metadata edukasi
- [ ] Panel list + filter konsep audit
- [ ] Tombol “Load ke Editor”
- DoD: minimal 8 starter query lintas 4 konsep audit.

### T10. Explain panel
- [ ] Tampilkan tujuan, cara baca output, red flag
- [ ] Bahasa Indonesia sederhana
- DoD: tiap starter query punya explain panel.

### T11. Guided practice mode ringan
- [ ] Latihan per konsep (rekonsiliasi, duplikasi, anomali)
- [ ] Template query + placeholder
- [ ] Hint 1/2
- DoD: latihan dasar bisa diselesaikan dari UI.

### T12. Glossary tooltip mini
- [ ] Kamus istilah audit+SQL (JSON lokal)
- [ ] Tooltip pada istilah di panel pembelajaran
- DoD: minimal 10 istilah tersedia.

### T13. Query history (session)
- [ ] Simpan history query sukses
- [ ] Klik item => isi editor
- [ ] Batas 30 item
- DoD: stabil, tidak disimpan lintas sesi.

### T14. CaseStudy JSON model + validator
- [ ] Tambah `src/data/caseStudies.json`
- [ ] Implement validasi field wajib:
  - `title`, `description`, `scenario[]`, `query`, `explanation`
- [ ] Tampilkan error konten jika JSON invalid
- DoD: app tetap jalan walau 1 case study invalid (skip item rusak).

### T15. Case Study panel + scenario picker
- [ ] List case study
- [ ] Detail case study (title/description/query/explanation)
- [ ] Scenario picker per case study
- [ ] Tombol “Load Query ke Editor”
- DoD: user bisa pindah case study/scenario tanpa reload app.

### T16. DB guidance + individual practice flow
- [ ] Tampilkan arahan DB yang harus dipilih per scenario (mis. `db`)
- [ ] Tampilkan blok “Individual Practice” dari konten scenario
- [ ] State indicator: DB belum cocok / sudah cocok
- DoD: flow lengkap case study -> scenario -> DB -> explain -> practice berjalan.

---

## M3 — Hardening & Classroom Readiness (P1)

### T17. Responsiveness & accessibility minimum
- [ ] Layout usable di 1366x768
- [ ] Keyboard navigable tombol utama
- [ ] Kontras teks memadai
- DoD: checklist aksesibilitas dasar lulus.

### T18. Stability test harness sederhana
- [ ] Skenario 20 query berurutan
- [ ] Verifikasi app tidak crash, worker tetap hidup
- DoD: lulus di Chrome & Edge.

### T19. Offline packaging
- [ ] Pastikan tidak ada CDN runtime
- [ ] Build artifact siap zip
- [ ] Buat `README-run.md` 1 halaman
- DoD: ekstrak zip + buka `index.html` langsung jalan.

### T20. Dataset + case-study readiness
- [ ] Validasi seluruh case study terhadap dataset yang benar
- [ ] Cek query demo return hasil masuk akal
- [ ] Cek instruksi practice bisa dikerjakan mahasiswa
- DoD: tidak ada case study broken pada paket rilis.

---

## 3) Prioritas Eksekusi (kalau waktu mepet)

Urutan paling hemat risiko:
1. T1–T8 (core explorer reliable)
2. T14–T16 (case study flow wajib pembelajaran)
3. T9–T10 (starter + explain)
4. T11–T13 (pengayaan belajar)
5. T17–T20 (hardening rilis kelas)

---

## 4) Definition of Done per Rilis

### DoD MVP Kelas (minimum layak pakai)
- [ ] T1–T8 selesai
- [ ] T14–T16 selesai
- [ ] T9 selesai minimal 5 starter query
- [ ] T10 selesai untuk query starter
- [ ] Smoke test offline lulus

### DoD v1.1 (siap 1 semester)
- [ ] T1–T20 selesai
- [ ] Stability test T18 lulus

---

## 5) Risiko + Mitigasi cepat

- Risiko: konten case study tidak konsisten antar dosen.
  - Mitigasi: tetapkan template JSON baku + contoh file referensi.

- Risiko: mahasiswa salah pilih DB untuk scenario.
  - Mitigasi: tampilkan nama DB yang diharapkan + status cocok/tidak.

- Risiko: UX belajar terlalu ramai.
  - Mitigasi: panel tambahan collapse, fokus alur inti dulu.

---

## 6) Deliverables

- [ ] `tasks.md` (dokumen ini)
- [ ] Source app sesuai M1-M3
- [ ] `starterQueries.json` + `caseStudies.json`
- [ ] `README-run.md` untuk dosen/mahasiswa
- [ ] Paket `dist.zip` siap distribusi kelas
