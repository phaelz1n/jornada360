import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMigrationAudit } from './migration-audit.js';

test('resume migração de backup sem armazenar o arquivo original', () => {
  const audit = buildMigrationAudit({ origem: 'backup-local', drivers: [{ nome: 'A' }], days: [{ dateKey: '2026-11-03' }] }, 'rh@transpinho.com', '2026-11-03T10:00:00.000Z');
  assert.deepEqual(audit, { action: 'backup_migrado', actorEmail: 'rh@transpinho.com', createdAt: '2026-11-03T10:00:00.000Z', source: 'backup-local', driverCount: 1, dayCount: 1 });
  assert.equal('file' in audit, false);
});
