// FR-04: hanya izinkan SELECT / WITH (CTE). Blok write & DDL sebelum dikirim ke engine.

const FORBIDDEN = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|TRUNCATE|ATTACH|DETACH|PRAGMA|VACUUM|REINDEX)\b/i;

export const assertReadOnly = (sqlRaw: string): void => {
  const sql = stripCommentsAndStrings(sqlRaw).trim();
  if (!sql) throw new Error('Query kosong.');
  const head = sql.split(/\s+/, 1)[0]?.toUpperCase() ?? '';
  if (head !== 'SELECT' && head !== 'WITH') {
    throw new Error('Mode belajar saat ini hanya mendukung SELECT/CTE.');
  }
  if (FORBIDDEN.test(sql)) {
    throw new Error('Mode belajar saat ini hanya mendukung SELECT/CTE.');
  }
};

// ponytail: parser mini, bukan SQL parser penuh. Cukup buang '...' "..." /* */ -- ...
const stripCommentsAndStrings = (s: string): string => {
  let out = '';
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    const n = s[i + 1];
    if (c === '-' && n === '-') { while (i < s.length && s[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') { i += 2; while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) i++; i += 2; continue; }
    if (c === "'" || c === '"') {
      const q = c; i++;
      while (i < s.length) { if (s[i] === q && s[i + 1] === q) { i += 2; continue; } if (s[i] === q) { i++; break; } i++; }
      out += ' ';
      continue;
    }
    out += c; i++;
  }
  return out;
};
