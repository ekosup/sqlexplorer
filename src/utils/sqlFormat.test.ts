import assert from 'node:assert/strict';
import test from 'node:test';
import { formatSql } from './sqlFormat';

test('formats a long select query into multiline clauses', () => {
  const sql = 'SELECT tanggal, cabang, nilai, COUNT(*) AS jumlah FROM transaksi GROUP BY tanggal, cabang, nilai HAVING COUNT(*) > 1 ORDER BY jumlah DESC;';
  const formatted = formatSql(sql);

  assert.match(formatted, /^SELECT\b/m);
  assert.match(formatted, /\nFROM\b/);
  assert.match(formatted, /\nGROUP BY\b/);
  assert.match(formatted, /\nHAVING\b/);
  assert.match(formatted, /\nORDER BY\b/);
  assert.ok(!formatted.includes('FROM transaksi GROUP BY'));
});
