import type { Database } from 'sql.js';
import type { ColumnInfo, TableSchema } from './types';

export const readSchema = (db: Database): TableSchema[] => {
  const tables = db.exec(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  if (tables.length === 0) return [];
  const names = tables[0].values.map((r) => String(r[0]));
  return names.map((name) => ({ name, columns: readColumns(db, name) }));
};

const readColumns = (db: Database, table: string): ColumnInfo[] => {
  // pragma_table_info bebas dari SQL injection risk karena nama tabel diambil dari sqlite_master.
  const res = db.exec(`PRAGMA table_info(${quoteIdent(table)})`);
  if (res.length === 0) return [];
  return res[0].values.map((r) => ({
    name: String(r[1]),
    type: String(r[2] ?? ''),
    notnull: Number(r[3]) === 1,
    pk: Number(r[5]) === 1,
  }));
};

const quoteIdent = (s: string): string => '"' + s.replace(/"/g, '""') + '"';
