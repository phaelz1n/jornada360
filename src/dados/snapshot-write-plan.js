import { createSnapshotEnvelope } from './snapshot-envelope.js';

export function createSnapshotWritePlan(day = {}) {
  const envelope = createSnapshotEnvelope(day);
  const data = { ...envelope, items: day.items };
  return [
    { collection: 'dias_processados', id: day.dateKey, data: envelope, merge: false },
    { collection: 'snapshots_dias', id: day.dateKey, data, merge: false },
    { collection: 'snapshots_dias', id: 'latest', data, merge: false }
  ];
}
