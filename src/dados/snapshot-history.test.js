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
