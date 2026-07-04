import type { WorkerRequest, WorkerResponse, QueryResult, TableSchema } from './types';
import SqlWorker from '../worker/sql.worker?worker';

export class SqlEngine {
  private worker: Worker;
  private seq = 0;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

  constructor() {
    this.worker = new SqlWorker();
    this.worker.addEventListener('message', (e: MessageEvent<WorkerResponse>) => {
      const { id, ok, result, error } = e.data;
      const p = this.pending.get(id);
      if (!p) return;
      this.pending.delete(id);
      if (ok) p.resolve(result);
      else p.reject(new Error(error ?? 'Unknown error'));
    });
  }

  private send<T>(req: WorkerRequest): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.pending.set(req.id, { resolve: resolve as (v: unknown) => void, reject });
      this.worker.postMessage(req);
    });
  }

  loadDb(bytes: Uint8Array): Promise<void> {
    return this.send<void>({ id: ++this.seq, kind: 'loadDb', bytes });
  }

  execQuery(sql: string): Promise<QueryResult> {
    return this.send<QueryResult>({ id: ++this.seq, kind: 'execQuery', sql });
  }

  getSchema(): Promise<TableSchema[]> {
    return this.send<TableSchema[]>({ id: ++this.seq, kind: 'getSchema' });
  }
}
