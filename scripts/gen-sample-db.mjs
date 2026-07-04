// One-off: generate public/datasets/sample-audit.sqlite (anonymous dummy data).
// Run: node scripts/gen-sample-db.mjs   (Node 22+ node:sqlite, experimental warning OK)
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'public', 'datasets');
const outFile = join(outDir, 'sample-audit.sqlite');
mkdirSync(outDir, { recursive: true });
rmSync(outFile, { force: true });

const db = new DatabaseSync(outFile);
db.exec(`
PRAGMA journal_mode = DELETE;
CREATE TABLE transaksi (
  id INTEGER PRIMARY KEY,
  tanggal TEXT NOT NULL,
  cabang TEXT NOT NULL,
  metode_bayar TEXT NOT NULL,
  nilai REAL NOT NULL
);
CREATE TABLE buku_besar (
  id INTEGER PRIMARY KEY,
  tanggal TEXT NOT NULL,
  akun TEXT NOT NULL,
  nilai REAL NOT NULL,
  transaksi_id INTEGER
);
CREATE TABLE karyawan (
  id INTEGER PRIMARY KEY,
  nama TEXT NOT NULL,
  jabatan TEXT NOT NULL,
  cabang TEXT NOT NULL
);
CREATE TABLE pemasok (
  id INTEGER PRIMARY KEY,
  nama TEXT NOT NULL,
  kota TEXT NOT NULL
);
CREATE TABLE pembelian (
  id INTEGER PRIMARY KEY,
  tanggal TEXT NOT NULL,
  pemasok_id INTEGER NOT NULL,
  nilai REAL NOT NULL
);
CREATE INDEX idx_trx_tanggal ON transaksi(tanggal);
CREATE INDEX idx_gl_trx ON buku_besar(transaksi_id);
`);

// Deterministic PRNG so dataset reproducible.
let seed = 20240704;
const rng = () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const round2 = (x) => Math.round(x * 100) / 100;

const cabangList = ['Jakarta', 'Bandung', 'Surabaya'];
const metodeList = ['Tunai', 'Transfer', 'Kartu Debit', 'QRIS'];
const namaDepan = ['Andi', 'Budi', 'Citra', 'Dewi', 'Eka', 'Fajar', 'Gita', 'Hadi', 'Indah', 'Joko', 'Kartika', 'Lina', 'Made', 'Nadia', 'Oki'];
const namaBelakang = ['Saputra', 'Wijaya', 'Hartono', 'Pratama', 'Lestari', 'Nugroho', 'Anggraini', 'Santoso', 'Maharani', 'Kusuma'];
const jabatanList = ['Kasir', 'Staf Akuntansi', 'Supervisor', 'Manager Cabang'];
const kotaList = ['Jakarta', 'Bandung', 'Surabaya', 'Semarang', 'Medan'];

const insKaryawan = db.prepare('INSERT INTO karyawan (id, nama, jabatan, cabang) VALUES (?,?,?,?)');
for (let i = 1; i <= 30; i++) {
  insKaryawan.run(i, `${pick(namaDepan)} ${pick(namaBelakang)}`, pick(jabatanList), pick(cabangList));
}

const insPemasok = db.prepare('INSERT INTO pemasok (id, nama, kota) VALUES (?,?,?)');
const pemasokCount = 12;
for (let i = 1; i <= pemasokCount; i++) {
  insPemasok.run(i, `PT ${pick(namaBelakang)} Sejahtera`, pick(kotaList));
}

const insPembelian = db.prepare('INSERT INTO pembelian (id, tanggal, pemasok_id, nilai) VALUES (?,?,?,?)');
for (let i = 1; i <= 80; i++) {
  const m = 1 + Math.floor(rng() * 12);
  const d = 1 + Math.floor(rng() * 28);
  insPembelian.run(i, `2024-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, 1 + Math.floor(rng() * pemasokCount), round2(500000 + rng() * 15000000));
}

// transaksi + buku_besar (GL). Normal range 200rb–8jt. Deliberate audit red-flags seeded below.
const insTrx = db.prepare('INSERT INTO transaksi (id, tanggal, cabang, metode_bayar, nilai) VALUES (?,?,?,?,?)');
const insGL = db.prepare('INSERT INTO buku_besar (id, tanggal, akun, nilai, transaksi_id) VALUES (?,?,?,?,?)');

const TOTAL = 320;
const tanggalOf = (i) => {
  const m = 1 + ((i + Math.floor(rng() * 3)) % 12);
  const d = 1 + Math.floor(rng() * 28);
  return `2024-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

let glSeq = 1;
for (let i = 1; i <= TOTAL; i++) {
  const nilai = round2(200000 + rng() * 7800000);
  const tanggal = tanggalOf(i);
  const cabang = pick(cabangList);
  const metode = pick(metodeList);
  insTrx.run(i, tanggal, cabang, metode, nilai);

  // GL posting normalnya 1:1 ke akun Pendapatan Penjualan. Skip beberapa untuk bikin gap rekonsiliasi.
  const missingInGL = (i === 41 || i === 137 || i === 209); // ponytail: hardcoded red-flags biar reproducible
  if (!missingInGL) {
    insGL.run(glSeq++, tanggal, '4-1000 Pendapatan Penjualan', nilai, i);
  }
}

// Duplikasi transaksi (red-flag): 3 pasang nilai/tanggal/cabang identik dengan id berbeda.
const dupPairs = [
  [321, 60, 'Bandung', 'Transfer'],
  [322, 145, 'Jakarta', 'QRIS'],
  [323, 230, 'Surabaya', 'Tunai'],
];
const stmtDupSrc = db.prepare('SELECT nilai, tanggal, cabang FROM transaksi WHERE id = ?');
for (const [newId, srcId, cabang, metode] of dupPairs) {
  const src = stmtDupSrc.get(srcId);
  insTrx.run(newId, src.tanggal, cabang, metode, src.nilai);
  insGL.run(glSeq++, src.tanggal, '4-1000 Pendapatan Penjualan', src.nilai, newId);
}

// Anomali nilai: 4 transaksi > 3x rentang normal (> 24jt) -> outlier.
const anomali = [324, 325, 326, 327];
for (const id of anomali) {
  const nilai = round2(30000000 + rng() * 40000000);
  const tanggal = tanggalOf(id);
  insTrx.run(id, tanggal, pick(cabangList), pick(metodeList), nilai);
  insGL.run(glSeq++, tanggal, '4-1000 Pendapatan Penjualan', nilai, id);
}

db.close();
console.log(`OK -> ${outFile}  (transaksi id 1..${anomali[anomali.length - 1]})`);
