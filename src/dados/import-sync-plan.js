import { createSnapshotWritePlan } from './snapshot-write-plan.js';

export function createImportSyncPlan(record = {}, day = {}) {
  if (!record.dateKey || record.dateKey !== day.dateKey) throw new Error('Importação e snapshot devem usar a mesma dateKey');
  return [
    { collection: 'importacoes', id: String(record.dateKey), data: record, merge: false },
    ...createSnapshotWritePlan(day)
  ];
}
