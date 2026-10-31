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
    resumo: 'HE total 02:00',
    padraoCadastradoMin: 120,
    heDentroPadraoMin: null,
    heAcimaPadraoMin: null,
    rastreadorStatus: null,
    evidenciaRastreador: [],
    padraoSuspeito: false,
    escalaEncontrada: false,
    escala: null,
    linhaExtraCandidata: false,
    batidas: [],
    padraoHorarios: [],
    detalhe: '',
    padraoStatus: ''
  }]);
});

test('identifica motorista sem horário padrão no checklist', () => {
  const [item] = snapshotItemsToChecklist([{ motorista: 'Ana', setor: 'Motoristas', he1min: 60, padraoStatus: 'sem_cadastro' }]);
  assert.equal(item.status, 'Sem horário padrão');
  assert.equal(item.semPadrao, true);
});
test('preserva padrão, divisão da HE e evidência do rastreador no checklist', () => {
  const [item] = snapshotItemsToChecklist([{ motorista: 'Ana', he1min: 30, padraoCadastradoMin: 20, heDentroPadraoMin: 20, heAcimaPadraoMin: 10, rastreadorStatus: 'confirmado', evidenciaRastreador: [{ horario: '08:00', status: 'confirmada' }], escalaEncontrada: true }]);
  assert.equal(item.padraoCadastradoMin, 20);
  assert.equal(item.heDentroPadraoMin, 20);
  assert.equal(item.heAcimaPadraoMin, 10);
  assert.equal(item.rastreadorStatus, 'confirmado');
  assert.equal(item.evidenciaRastreador[0].status, 'confirmada');
});

test('ignora itens sem motorista e preserva categorias especiais', () => {
  const items = snapshotItemsToChecklist([{ motorista: '', setor: 'Motoristas' }, { motorista: 'Olívio Rodrigues', categoria: 'Folguista', totalHE: 0 }]);
  assert.equal(items.length, 1);
  assert.equal(items[0].setor, 'Folguista');
});
