import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshotItemsToChecklist } from './checklist-adapter.js';

test('adapta itens antigos salvos como mapa no checklist', () => {
  const [item] = snapshotItemsToChecklist({ ana: { motorista: 'Ana', he1min: 10 } });
  assert.equal(item.motorista, 'Ana');
});

test('converte item de snapshot no formato do checklist', () => {
  const items = snapshotItemsToChecklist([{ motorista: 'Cristiano Francisco Barreto', setor: 'Motoristas', totalHE: 120, padraoMin: 120, status: 'ok' }]);
  assert.deepEqual(items, [{
    id: 'cristiano-francisco-barreto',
    motorista: 'Cristiano Francisco Barreto',
    setor: 'Motoristas',
    status: 'Confirmado',
    semPadrao: false,
    resumo: 'HE total 02:00',
    totalHE: 120,
    padraoCadastradoMin: 120,
    heDentroPadraoMin: null,
    heAcimaPadraoMin: null,
    rastreadorStatus: null,
    evidenciaRastreador: [],
    padraoSuspeito: false,
    escalaEncontrada: false,
    escala: null,
    linhaExtraCandidata: false,
    linhaExtraDetalhe: '',
    rastreiosForaDaEscala: [],
    foraDaEscalaProblema: false,
    foraDaEscalaDetalhe: '',
    interjornadaProblema: false,
    intervaloMenorUmaHora: false,
    intervaloObrigatorioAusente: false,
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
test('mostra resumo quando as horas chegam formatadas como HH:MM', () => {
  const [item] = snapshotItemsToChecklist([{ motorista: 'Ademar', he1str: '00:30', padraoCadastradoMin: 0 }]);
  assert.equal(item.resumo, 'HE total 00:30');
  assert.equal(item.status, 'Pendente');
});
test('preserva padrão, divisão da HE e evidência do rastreador no checklist', () => {
  const [item] = snapshotItemsToChecklist([{ motorista: 'Ana', he1min: 30, padraoCadastradoMin: 20, heDentroPadraoMin: 20, heAcimaPadraoMin: 10, rastreadorStatus: 'confirmado', evidenciaRastreador: [{ horario: '08:00', status: 'confirmada' }], escalaEncontrada: true }]);
  assert.equal(item.padraoCadastradoMin, 20);
  assert.equal(item.heDentroPadraoMin, 20);
  assert.equal(item.heAcimaPadraoMin, 10);
  assert.equal(item.rastreadorStatus, 'confirmado');
  assert.equal(item.evidenciaRastreador[0].status, 'confirmada');
});

test('não expõe extra candidata de padrão negativo no checklist', () => {
  const [item] = snapshotItemsToChecklist([{ motorista: 'Ademar', he1min: 0, padraoCadastradoMin: -25, extraCandidataMin: 25, extraAuditoriaStatus: 'sem-escala-sem-rastreio', extraAuditoriaDetalhe: 'Não há comprovação.' }]);
  assert.equal(item.status, 'Pendente de comprovação');
  assert.equal(item.extraCandidataMin, undefined);
  assert.equal(item.extraAuditoriaStatus, 'sem-escala-sem-rastreio');
});

test('ignora itens sem motorista e preserva categorias especiais', () => {
  const items = snapshotItemsToChecklist([{ motorista: '', setor: 'Motoristas' }, { motorista: 'Olívio Rodrigues', categoria: 'Folguista', totalHE: 0 }]);
  assert.equal(items.length, 1);
  assert.equal(items[0].setor, 'Folguista');
});

test('preserva HE calculada para exibição no cartão do checklist', () => {
  const [item] = snapshotItemsToChecklist([{ motorista: 'Anderson', totalHE: 40, padraoCadastradoMin: 45 }]);
  assert.equal(item.totalHE, 40);
});

test('usa os buckets oficiais quando totalHE salvo está desatualizado', () => {
  const [item] = snapshotItemsToChecklist([{ motorista: 'Marcos Viegas', totalHE: 96, he1min: 11, he2min: 0, he3min: 0, heBucketsExplicit: true, padraoCadastradoMin: 0 }]);
  assert.equal(item.totalHE, 11);
  assert.equal(item.resumo, 'HE total 00:11');
});

test('mantém a linha extra na justificativa quando a sugestão não foi salva', () => {
  const [item] = snapshotItemsToChecklist([{ motorista: 'Marcos Viegas', totalHE: 11, linhaExtraCandidata: true, linhaExtraDetalhe: 'Possível linha extra: UTILIZADO — consta na escala e há batida compatível.' }]);
  assert.match(item.justificativaSugerida, /UTILIZADO/);
});
