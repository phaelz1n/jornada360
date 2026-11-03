import test from 'node:test';
import assert from 'node:assert/strict';
import { SNAPSHOT_SCHEMA_VERSION, createSnapshotEnvelope } from './snapshot-envelope.js';

test('salva snapshots com versão e identidade do dia', () => {
  const result = createSnapshotEnvelope({ dateKey: '2026-11-03', items: [{ motorista: 'Ana' }] });
  assert.equal(result.schemaVersion, SNAPSHOT_SCHEMA_VERSION);
  assert.equal(result.snapshotId, '2026-11-03');
  assert.deepEqual(result.items, [{ motorista: 'Ana' }]);
  assert.ok(result.updatedAt);
});

test('rejeita snapshot sem data para não criar documento inválido', () => {
  assert.throws(() => createSnapshotEnvelope({ items: [] }), /dateKey/);
});
