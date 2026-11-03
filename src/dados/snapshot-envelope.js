export const SNAPSHOT_SCHEMA_VERSION = 2;

export function createSnapshotEnvelope(day = {}) {
  if (!day.dateKey) throw new Error('Snapshot dateKey é obrigatório');
  return {
    ...day,
    snapshotId: String(day.dateKey),
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    updatedAt: day.updatedAt || new Date().toISOString()
  };
}
