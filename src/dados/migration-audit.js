export function buildMigrationAudit(payload = {}, actorEmail = '', createdAt = new Date().toISOString()) {
  return {
    action: 'backup_migrado',
    dateKey: 'migration',
    actorEmail: String(actorEmail || ''),
    createdAt,
    source: String(payload.origem || 'backup-local'),
    driverCount: Number(payload.drivers?.length) || 0,
    dayCount: Number(payload.days?.length) || 0
  };
}
