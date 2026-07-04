// T18: stability test harness. Runs 20 mixed queries (valid + invalid) through the
// real worker pipeline, asserts each matched expectation, then probes the worker
// is still alive. Pure data — UI rendering lives in main.ts.
import type { SqlEngine } from '../db/engine';

type Expect = 'ok' | 'error';

interface Case {
  label: string;
  sql: string;
  expect: Expect;
}

export interface RowResult {
  label: string;
  expect: Expect;
  got: Expect;
  match: boolean;
  ms: number;
  detail?: string;
}

export interface StabilityReport {
  rows: RowResult[];
  passed: number;
  failed: number;
  totalMs: number;
  workerAlive: boolean;
}

// 15 valid + 5 invalid (FR-04 read-only guard, FR-05 error mapping ikut teruji).
const SCRIPT: Case[] = [
  { label: 'list tabel', sql: "SELECT name FROM sqlite_master WHERE type='table'", expect: 'ok' },
  { label: 'count transaksi', sql: 'SELECT COUNT(*) FROM transaksi', expect: 'ok' },
  { label: 'count buku_besar', sql: 'SELECT COUNT(*) FROM buku_besar', expect: 'ok' },
  { label: 'limit 10', sql: 'SELECT * FROM transaksi LIMIT 10', expect: 'ok' },
  { label: 'group by cabang', sql: 'SELECT cabang, COUNT(*) FROM transaksi GROUP BY cabang', expect: 'ok' },
  { label: 'tren bulanan', sql: "SELECT strftime('%Y-%m', tanggal) b, COUNT(*) FROM transaksi GROUP BY b", expect: 'ok' },
  { label: 'rekonsiliasi (LEFT JOIN gap)', sql: 'SELECT t.id FROM transaksi t LEFT JOIN buku_besar g ON g.transaksi_id=t.id WHERE g.id IS NULL', expect: 'ok' },
  { label: 'duplikasi (HAVING)', sql: 'SELECT tanggal, cabang, nilai, COUNT(*) c FROM transaksi GROUP BY tanggal, cabang, nilai HAVING c>1', expect: 'ok' },
  { label: 'agregat min/max/avg', sql: 'SELECT MAX(nilai), MIN(nilai), AVG(nilai) FROM transaksi', expect: 'ok' },
  { label: 'limit karyawan', sql: 'SELECT * FROM karyawan LIMIT 5', expect: 'ok' },
  { label: 'limit pemasok', sql: 'SELECT * FROM pemasok LIMIT 5', expect: 'ok' },
  { label: 'join pembelian', sql: 'SELECT p.nama, COUNT(*) FROM pembelian b JOIN pemasok p ON p.id=b.pemasok_id GROUP BY p.id', expect: 'ok' },
  { label: 'sampling random', sql: 'SELECT * FROM transaksi ORDER BY RANDOM() LIMIT 5', expect: 'ok' },
  { label: 'CTE', sql: 'WITH x AS (SELECT COUNT(*) n FROM transaksi) SELECT * FROM x', expect: 'ok' },
  { label: 'sum per cabang', sql: 'SELECT cabang, ROUND(SUM(nilai),0) FROM transaksi GROUP BY cabang', expect: 'ok' },
  { label: 'no such table', sql: 'SELECT * FROM tabel_tidak_ada', expect: 'error' },
  { label: 'no such column', sql: 'SELECT kolong_salah FROM transaksi', expect: 'error' },
  { label: 'syntax error', sql: 'SELECT FROM transaksi', expect: 'error' },
  { label: 'INSERT diblok read-only', sql: "INSERT INTO transaksi VALUES(999,'2024-01-01','Jakarta','Tunai',1)", expect: 'error' },
  { label: 'DROP diblok read-only', sql: 'DROP TABLE transaksi', expect: 'error' },
];

export const STABILITY_COUNT = SCRIPT.length;

export const runStabilityTest = async (engine: SqlEngine): Promise<StabilityReport> => {
  const rows: RowResult[] = [];
  const t0 = performance.now();

  for (const c of SCRIPT) {
    const s = performance.now();
    let got: Expect = 'ok';
    let detail: string | undefined;
    try {
      await engine.execQuery(c.sql);
    } catch (e) {
      got = 'error';
      detail = (e as Error).message;
    }
    rows.push({ label: c.label, expect: c.expect, got, match: got === c.expect, ms: Math.round(performance.now() - s), detail });
    // Beri kesempatan event loop agar UI tetap responsif (NFR-02) antar query.
    await new Promise((r) => setTimeout(r, 0));
  }

  let workerAlive = true;
  try {
    await engine.execQuery('SELECT 1');
  } catch {
    workerAlive = false;
  }

  const totalMs = Math.round(performance.now() - t0);
  const failed = rows.filter((r) => !r.match).length;
  return { rows, passed: rows.length - failed, failed, totalMs, workerAlive };
};
