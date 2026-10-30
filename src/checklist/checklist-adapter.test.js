import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshotItemsToChecklist } from './checklist-adapter.js';

test('converte item de snapshot no formato do checklist', () => {
  const items = snapshotItemsToChecklist([{ motorista: 'Cristiano Francisco Barreto', setor: 'Motoristas', totalHE: 120, padraoMin: 120, status: 'ok' }]);
  assert.deepEqual(items, [{
    id: 'cristiano-francisco-barreto',
    motorista: 'Cristiano Francisco Barreto',
    setor: 'Motoristas',
    status: 'Confirmado',
    semPadrao: false,
    resumo: 'HE.1 02:00'
  }]);
});

test('identifica motorista sem horário padrão no checklist', () => {
  const [item] = snapshotItemsToChecklist([{ motorista: 'Ana', setor: 'Motoristas', he1min: 60, padraoStatus: 'sem_cadastro' }]);
  assert.equal(item.status, 'Sem horário padrão');
  assert.equal(item.semPadrao, true);
});

test('ignora itens sem motorista e preserva categorias especiais', () => {
  const items = snapshotItemsToChecklist([{ motorista: '', setor: 'Motoristas' }, { motorista: 'Olívio Rodrigues', categoria: 'Folguista', totalHE: 0 }]);
  assert.equal(items.length, 1);
  assert.equal(items[0].setor, 'Folguista');
});
