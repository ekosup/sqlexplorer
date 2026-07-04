// Persistensi database SQLite antar-refresh.
// Disimpan di IndexedDB (bukan localStorage) karena file .sqlite bisa >5MB.
// Hilang hanya via clearSavedDb() (tombol "Clear DB") atau ditimpa saveDb() (upload baru).

const DB_NAME = 'sqlexplorer';
const STORE = 'db';
const KEY = 'current';

export type SavedDb = { name: string; bytes: ArrayBuffer; savedAt: number };

const open = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const run = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const r = fn(db.transaction(STORE, mode).objectStore(STORE));
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  } finally {
    db.close();
  }
};

export const saveDb = (name: string, bytes: ArrayBuffer): Promise<void> =>
  run('readwrite', (s) => s.put({ name, bytes, savedAt: Date.now() } as SavedDb, KEY)).then(() => undefined);

// ponytail: bila IndexedDB unavailable (private mode / korup), degrade ke null = no-persistence.
export const loadSavedDb = async (): Promise<SavedDb | null> => {
  try {
    return ((await run<SavedDb | undefined>('readonly', (s) => s.get(KEY))) ?? null);
  } catch {
    return null;
  }
};

export const clearSavedDb = (): Promise<void> =>
  run('readwrite', (s) => s.delete(KEY)).then(() => undefined);
