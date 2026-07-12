export type ImportColumn = { name: string; type: 'INTEGER' | 'REAL' | 'TEXT' };

export type WorkerRequest =
  | { id: number; kind: 'loadDb'; bytes: Uint8Array }
  | { id: number; kind: 'execQuery'; sql: string }
  | { id: number; kind: 'getSchema' }
  | { id: number; kind: 'importData'; tableName: string; columns: ImportColumn[]; rows: unknown[][] }
  | { id: number; kind: 'exportDb' };

export type WorkerResponse = {
  id: number;
  ok: boolean;
  result?: unknown;
  error?: string;
};

export type QueryResult = {
  columns: string[];
  values: unknown[][];
};

export type ColumnInfo = {
  name: string;
  type: string;
  notnull: boolean;
  pk: boolean;
};

export type TableSchema = {
  name: string;
  columns: ColumnInfo[];
};
