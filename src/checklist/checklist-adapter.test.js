import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshotItemsToChecklist } from './checklist-adapter.js';

test('converte item de snapshot no formato do checklist', () => {
  const items = snapshotItemsToChecklist([{ motorista: 'Cristiano Francisco Barreto', setor: 'Motoristas', totalHE: 120, status: 'ok' }]);
  assert.deepEqual(items, [{
    id: 'cristiano-francisco-barreto',
    motorista: 'Cristiano Francisco Barreto',
    setor: 'Motoristas',
    status: 'Confirmado',
    resumo: 'HE.1 02:00'
  }]);
});

test('ignora itens sem motorista e preserva categorias especiais', () => {
  const items = snapshotItemsToChecklist([{ motorista: '', setor: 'Motoristas' }, { motorista: 'Olívio Rodrigues', categoria: 'Folguista', totalHE: 0 }]);
  assert.equal(items.length, 1);
  assert.equal(items[0].setor, 'Folguista');
});
