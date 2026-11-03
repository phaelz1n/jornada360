import test from 'node:test';
import assert from 'node:assert/strict';
import { backupToChecklistItems } from './backup-loader.js';

test('extrai itens do primeiro dia do backup JSON', () => {
  const result = backupToChecklistItems({ dias: [{ snapshot: { items: [{ motorista: 'Ana', setor: 'Motoristas', totalHE: 30 }] } }] });
  assert.equal(result.length, 1);
  assert.equal(result[0].motorista, 'Ana');
});

test('aceita também snapshot direto', () => {
  const result = backupToChecklistItems({ snapshot: { items: [{ nome: 'Bruno', categoria: 'Reserva' }] } });
  assert.equal(result[0].setor, 'Reserva');
});
