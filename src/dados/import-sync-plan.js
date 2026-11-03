import { createSnapshotWritePlan } from './snapshot-write-plan.js';

export function buildImportAudit(record = {}) {
  return {
    action: 'importacao_processada',
    dateKey: record.dateKey,
    actorEmail: record.actorEmail || '',
    createdAt: record.createdAt || new Date().toISOString(),
    sources: Object.fromEntries(Object.entries(record.files || {}).map(([sourceId, metadata]) => [sourceId, metadata ? { name: metadata.name || '', size: Number(metadata.size) || 0, rows: Number(metadata.rows) || 0 } : null]))
  };
}

export function createImportSyncPlan(record = {}, day = {}) {
  if (!record.dateKey || record.dateKey !== day.dateKey) throw new Error('Importação e snapshot devem usar a mesma dateKey');
  const auditId = `import-${encodeURIComponent(String(record.dateKey))}-${encodeURIComponent(String(record.createdAt || 'unknown'))}`;
  return [
    { collection: 'importacoes', id: String(record.dateKey), data: record, merge: false },
    ...createSnapshotWritePlan(day),
    { collection: 'historico_auditoria', id: auditId, data: buildImportAudit(record), merge: false }
  ];
}
