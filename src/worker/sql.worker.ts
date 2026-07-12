/// <reference lib="webworker" />
import initSqlJs, { type Database } from 'sql.js';
// Vite: import URL asset agar wasm ikut ter-bundle (offline, NFR-01).
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { readSchema } from '../db/schema';
import { assertReadOnly } from './readonlyGuard';
import { friendlyError } from './errorMap';
import type { WorkerRequest, WorkerResponse, QueryResult } from '../db/types';

let dbPromise: Promise<Database> | null = null;
const sqlPromise = initSqlJs({ locateFile: () => wasmUrl });

const openDb = async (bytes: Uint8Array): Promise<Database> => {
  const SQL = await sqlPromise;
  return new SQL.Database(bytes);
};

const requireDb = async (): Promise<Database> => {
  if (!dbPromise) throw new Error('Belum ada database dimuat. Silakan pilih file .sqlite terlebih dahulu.');
  return dbPromise;
};

const quoteIdent = (s: string): string => '"' + s.replace(/"/g, '""') + '"';

const handle = async (req: WorkerRequest): Promise<unknown> => {
  switch (req.kind) {
    case 'loadDb': {
      dbPromise = openDb(req.bytes);
      await dbPromise;
      return null;
    }
    case 'execQuery': {
      assertReadOnly(req.sql);
      const db = await requireDb();
      const res = db.exec(req.sql);
      // Ambil result-set terakhir yang punya kolom; kalau tidak ada, kembalikan kosong.
      const last = res[res.length - 1];
      const out: QueryResult = last
        ? { columns: last.columns, values: last.values as unknown[][] }
        : { columns: [], values: [] };
      return out;
    }
    case 'getSchema': {
      const db = await requireDb();
      return readSchema(db);
    }
    case 'importData': {
      // Import Excel/CSV → tabel baru. Bypass read-only guard (ini fitur import, bukan query user).
      // Buat DB kosong bila belum ada satupun DB dimuat.
      if (!dbPromise) {
        const SQL = await sqlPromise;
        dbPromise = Promise.resolve(new SQL.Database());
      }
      const db = await dbPromise;
      const tbl = quoteIdent(req.tableName);
      const colDefs = req.columns.map((c) => `${quoteIdent(c.name)} ${c.type}`).join(', ');
      db.run(`DROP TABLE IF EXISTS ${tbl}`);
      db.run(`CREATE TABLE ${tbl} (${colDefs})`);
      const placeholders = req.columns.map(() => '?').join(', ');
      const stmt = db.prepare(`INSERT INTO ${tbl} VALUES (${placeholders})`);
      try {
        db.run('BEGIN');
        for (const row of req.rows) {
          const bind = row.map((v) =>
            v == null ? null : typeof v === 'boolean' ? (v ? 1 : 0) : (v as string | number),
          );
          stmt.run(bind as (string | number | null)[]);
        }
        db.run('COMMIT');
      } catch (e) {
        db.run('ROLLBACK');
        throw e;
      } finally {
        stmt.free();
      }
      return null;
    }
    case 'exportDb': {
      const db = await requireDb();
      return db.export();
    }
  }
};

self.addEventListener('message', (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  handle(req).then(
    (result) => {
      const res: WorkerResponse = { id: req.id, ok: true, result };
      (self as unknown as Worker).postMessage(res);
    },
    (err: unknown) => {
      const res: WorkerResponse = { id: req.id, ok: false, error: friendlyError(err) };
      (self as unknown as Worker).postMessage(res);
    },
  );
});
