// Persistensi database SQLite antar-refresh.
// Disimpan di IndexedDB (bukan localStorage) karena file .sqlite bisa >5MB.
// Hilang hanya via clearSavedDb() (tombol "Clear DB") atau ditimpa saveDb() (upload baru).

import { storeRun } from './storage';

export type SavedDb = { name: string; bytes: ArrayBuffer; savedAt: number };

export const saveDb = (name: string, bytes: ArrayBuffer): Promise<void> =>
  storeRun('db', 'readwrite', (s) => s.put({ name, bytes, savedAt: Date.now() } as SavedDb, 'current')).then(() => undefined);

// ponytail: bila IndexedDB unavailable (private mode / korup), degrade ke null = no-persistence.
export const loadSavedDb = async (): Promise<SavedDb | null> => {
  try {
    return ((await storeRun<SavedDb | undefined>('db', 'readonly', (s) => s.get('current'))) ?? null);
  } catch {
    return null;
  }
};

export const clearSavedDb = (): Promise<void> =>
  storeRun('db', 'readwrite', (s) => s.delete('current')).then(() => undefined);
