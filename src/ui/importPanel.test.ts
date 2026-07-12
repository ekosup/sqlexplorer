import assert from 'node:assert/strict';
import test from 'node:test';
import { inferType } from './importPanel';

test('inferType maps column values to SQLite affinity', () => {
  assert.equal(inferType([1, 2, 3]), 'INTEGER');
  assert.equal(inferType([1, 2.5, 3]), 'REAL');
  assert.equal(inferType([1, 'abc', 3]), 'TEXT');
  assert.equal(inferType([null, '', null]), 'TEXT'); // tak ada nilai → default TEXT
  assert.equal(inferType([10, null, 20]), 'INTEGER'); // null diabaikan
});
