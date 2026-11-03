import { validateSnapshot } from './snapshot-validation.js';

export const SNAPSHOT_SCHEMA_VERSION = 2;

export function createSnapshotEnvelope(day = {}) {
  const validation = validateSnapshot(day);
  if (!validation.valid) throw new Error(`Snapshot inválido: ${validation.errors.join('; ')}`);
  return {
    ...day,
    snapshotId: String(day.dateKey),
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    updatedAt: day.updatedAt || new Date().toISOString()
  };
}
