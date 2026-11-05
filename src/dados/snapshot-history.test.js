import test from 'node:test';
import assert from 'node:assert/strict';
import { dedupeSnapshots } from './snapshot-history.js';

test('remove latest e não repete a mesma data no histórico', () => {
  const result = dedupeSnapshots([
    { id: '2026-11-02', dateKey: '2026-11-02', items: [{ motorista: 'Ana' }] },
    { id: 'latest', dateKey: '2026-11-02', items: [{ motorista: 'Ana' }] },
    { id: '2026-11-01', dateKey: '2026-11-01', items: [] }
  ]);
  assert.deepEqual(result.map(item => item.dateKey), ['2026-11-01', '2026-11-02']);
});

test('trata ISO e formato brasileiro como a mesma data', () => {
  const result = dedupeSnapshots([
    { dateKey: '2026-11-04', items: [{ motorista: 'A' }] },
    { dateKey: '04/11/2026', items: [{ motorista: 'B' }] }
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].dateKey, '2026-11-04');
});
