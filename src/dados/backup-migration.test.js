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

test('remove campos indefinidos antes do envio', () => {
  const payload = buildMigrationPayload({ dias: [{ dateKey: '2026-10-01', snapshot: { items: [{ motorista: 'Ana', setorAtual: undefined, detalhe: undefined }] } }] });
  assert.equal(Object.hasOwn(payload.drivers[0], 'setor'), true);
  assert.equal(Object.hasOwn(payload.days[0].snapshot.items[0], 'detalhe'), false);
});

test('usa setor salvo no caseState e categorias especiais', () => {
  const payload = buildMigrationPayload({ dias: [{ dateKey: '2026-10-01', caseState: { 'Ana Silva': { setor: 'ADM' } }, snapshot: { items: [
    { motorista: 'Ana Silva' }, { motorista: 'OLIVIO RODRIGUES DE FREITAS' }, { motorista: 'GIOVANI OLIVEIRA DE SOUZA' },
  ] } }] });
  assert.equal(payload.drivers.find(item => item.nome === 'Ana Silva').setor, 'ADM');
  assert.equal(payload.drivers.find(item => item.nome.startsWith('OLIVIO')).setor, 'Folguista');
  assert.equal(payload.drivers.find(item => item.nome.startsWith('GIOVANI')).setor, 'Reserva');
});
