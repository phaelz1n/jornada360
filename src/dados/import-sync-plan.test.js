import test from 'node:test';
import assert from 'node:assert/strict';
import { createImportSyncPlan } from './import-sync-plan.js';

test('combina importação e snapshot no mesmo lote', () => {
  const plan = createImportSyncPlan({ dateKey: '2026-11-03', createdAt: '2026-11-03T10:00:00.000Z' }, { dateKey: '2026-11-03', items: [] });
  assert.deepEqual(plan.map(item => [item.collection, item.id]), [
    ['importacoes', '2026-11-03'],
    ['dias_processados', '2026-11-03'],
    ['snapshots_dias', '2026-11-03'],
    ['snapshots_dias', 'latest'],
    ['historico_auditoria', 'import-2026-11-03-2026-11-03T10%3A00%3A00.000Z']
  ]);
  assert.equal(plan.find(item => item.collection === 'snapshots_dias' && item.id === 'latest').merge, true);
});

test('auditoria guarda apenas metadados da importação', () => {
  const plan = createImportSyncPlan({
    dateKey: '2026-11-03',
    createdAt: '2026-11-03T10:00:00.000Z',
    actorEmail: 'rh@transpinho.com',
    files: { ponto: { name: 'ponto.xlsx', size: 120, rows: 8 }, rastreador: null }
  }, { dateKey: '2026-11-03', items: [] });
  const audit = plan.at(-1).data;
  assert.equal(audit.actorEmail, 'rh@transpinho.com');
  assert.deepEqual(audit.sources, { ponto: { name: 'ponto.xlsx', size: 120, rows: 8 }, rastreador: null });
  assert.equal('content' in audit, false);
});
