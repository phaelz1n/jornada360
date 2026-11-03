import test from 'node:test';
import assert from 'node:assert/strict';
import { createImportSyncPlan } from './import-sync-plan.js';

test('combina importação e snapshot no mesmo lote', () => {
  const plan = createImportSyncPlan({ dateKey: '2026-11-03', createdAt: '2026-11-03T10:00:00.000Z' }, { dateKey: '2026-11-03', items: [] });
  assert.deepEqual(plan.map(item => [item.collection, item.id]), [
    ['importacoes', '2026-11-03'],
    ['dias_processados', '2026-11-03'],
    ['snapshots_dias', '2026-11-03'],
    ['snapshots_dias', 'latest']
  ]);
  assert.equal(plan.at(-1).merge, true);
});
