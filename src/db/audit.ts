// Audit log hasil query: flat text per entry (TSV), survive db swap + refresh.
// Tujuan: peserta bisa mereview/export apa yang pernah dijalankan meski DB sudah diganti.

import { storeRun, openDb } from './storage';

// ponytail: cap baris hasil per entry — audit = ringkasan, bukan dump penuh. Naikkan bila perlu.
const MAX_ROWS = 200;
// ponytail: cap total entry; entri tertua auto-dihapus. ceiling O(n) getAllKeys per append.
const MAX_ENTRIES = 200;

export type AuditEntry = {
  ts: number;
  dbName: string;
  sql: string;
  ms: number;
  rowCount: number;
  text: string; // TSV: header + baris (dipotong MAX_ROWS)
  error?: string;
};

const escCell = (v: unknown): string => {
  if (v == null) return '';
  const s = String(v);
  return /["\t\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

export const toTsv = (cols: string[], rows: unknown[][]): string => {
  const head = cols.map(escCell).join('\t');
  const body = rows.slice(0, MAX_ROWS).map((r) => r.map(escCell).join('\t')).join('\n');
  return body ? `${head}\n${body}` : head;
};

export const appendAudit = async (e: AuditEntry): Promise<void> => {
  await storeRun('audit', 'readwrite', (s) => s.add(e));
  const keys = await storeRun<IDBValidKey[]>('audit', 'readonly', (s) => s.getAllKeys());
  if (keys.length <= MAX_ENTRIES) return;
  // hapus entri tertua (key autoIncrement monoton naik).
  const excess = keys.slice(0, keys.length - MAX_ENTRIES);
  const db = await openDb();
  const tx = db.transaction('audit', 'readwrite');
  const store = tx.objectStore('audit');
  for (const k of excess) store.delete(k);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const listAudit = (): Promise<AuditEntry[]> =>
  // ponytail: bila private mode melempar, anggap kosong.
  storeRun<AuditEntry[]>('audit', 'readonly', (s) => s.getAll()).catch(() => [] as AuditEntry[]);

export const clearAudit = (): Promise<void> =>
  storeRun('audit', 'readwrite', (s) => s.clear()).then(() => undefined);

const fmtTs = (ts: number): string => new Date(ts).toLocaleString('id-ID');

// Render seluruh log jadi satu flat text (untuk export .txt).
export const toAuditText = (entries: AuditEntry[]): string => {
  if (entries.length === 0) return '(kosong)';
  const blocks = entries.map((e, i) => {
    const lines = [
      `========================================`,
      `#${i + 1}  ${fmtTs(e.ts)}  |  DB: ${e.dbName || '(tanpa nama)'}  |  ${e.rowCount} baris  |  ${e.ms} ms`,
      `----------------------------------------`,
      `SQL:`,
      indent(e.sql),
      `----------------------------------------`,
    ];
    if (e.error) {
      lines.push(`ERROR: ${e.error}`, `----------------------------------------`);
    } else {
      lines.push(`RESULT (TSV):`, indent(e.text || '(tidak ada baris)'), `----------------------------------------`);
    }
    return lines.join('\n');
  });
  return `SQLExplorer Audit Log\nDibuat: ${fmtTs(Date.now())}\nTotal: ${entries.length} entry\n\n${blocks.join('\n\n')}`;
};

const indent = (s: string): string => s.split('\n').map((l) => '  ' + l).join('\n');
