// Koneksi IndexedDB bersama untuk semua store persisten (DB SQLite + audit log).
// ponytail: koneksi di-cache (singleton). Aplikasi single-tab; tutup manual tidak perlu.

const DB_NAME = 'sqlexplorer';
const DB_VERSION = 2;

let dbPromise: Promise<IDBDatabase> | null = null;

export const openDb = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // store 'db': out-of-line key 'current' (satu DB aktif).
      if (!db.objectStoreNames.contains('db')) db.createObjectStore('db');
      // store 'audit': autoIncrement key, append-only.
      if (!db.objectStoreNames.contains('audit')) db.createObjectStore('audit', { autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
};

// Jalankan satu request terhadap store. Untuk multi-request dalam satu tx, pakai openDb() langsung.
export const storeRun = async <T>(
  store: 'db' | 'audit',
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const r = fn(db.transaction(store, mode).objectStore(store));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
};
