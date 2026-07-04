import { assertReadOnly } from '../src/worker/readonlyGuard.ts';
const cases: [string, boolean][] = [
  ['SELECT * FROM t', true],
  ['select 1', true],
  ['WITH x AS (SELECT 1) SELECT * FROM x', true],
  ['INSERT INTO t VALUES(1)', false],
  ['DROP TABLE t', false],
  ['UPDATE t SET a=1', false],
  ['DELETE FROM t', false],
  ['CREATE TABLE t(a)', false],
  ['-- comment\nSELECT 1', true],
  ["SELECT '-- INSERT' FROM t", true],
  ['SELECT 1; DROP TABLE t', false],
  ['   ', false],
];
let bad = 0;
for (const [sql, expectOk] of cases) {
  let got = true;
  try { assertReadOnly(sql); } catch { got = false; }
  if (got !== expectOk) { console.error('FAIL:', JSON.stringify(sql), 'expected', expectOk, 'got', got); bad++; }
}
console.log(bad === 0 ? `guard OK (${cases.length} cases)` : `guard FAILED ${bad}`);
process.exit(bad === 0 ? 0 : 1);
