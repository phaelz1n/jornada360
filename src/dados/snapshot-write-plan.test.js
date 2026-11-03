import test from 'node:test';
import assert from 'node:assert/strict';
import { createSnapshotWritePlan } from './snapshot-write-plan.js';

test('monta escrita atômica para dia processado, snapshot e latest', () => {
  const plan = createSnapshotWritePlan({ dateKey: '2026-11-03', items: [{ motorista: 'Ana' }] });
  assert.deepEqual(plan.map(item => [item.collection, item.id, item.merge]), [
    ['dias_processados', '2026-11-03', false],
    ['snapshots_dias', '2026-11-03', false],
    ['snapshots_dias', 'latest', true]
  ]);
  assert.equal(plan[0].data.schemaVersion, 2);
});
