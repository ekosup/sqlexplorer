export type WorkerRequest =
  | { id: number; kind: 'loadDb'; bytes: Uint8Array }
  | { id: number; kind: 'execQuery'; sql: string }
  | { id: number; kind: 'getSchema' };

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
