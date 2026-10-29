import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMigrationPayload, migrationStats } from './backup-migration.js';

test('consolida motoristas e preserva setores do backup', () => {
  const payload = buildMigrationPayload({ dias: [
    { dateKey: '2026-10-01', snapshot: { items: [{ motorista: ' Ana  Silva ', setorAtual: 'Motoristas' }] } },
    { dateKey: '2026-10-02', snapshot: { items: [{ motorista: 'Ana Silva', setorAtual: 'Sem setor' }, { motorista: 'Bia', setor: 'Reserva' }] } },
  ] });
  assert.deepEqual(migrationStats(payload), { drivers: 2, days: 2 });
  assert.equal(payload.drivers.find(item => item.nome === 'Ana Silva').setor, 'Motoristas');
});
