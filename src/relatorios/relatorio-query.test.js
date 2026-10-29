import test from 'node:test';
import assert from 'node:assert/strict';
import { consultarDia, consultarPeriodo } from './relatorio-query.js';

const snapshots = [
  { dateKey: '2026-09-28', items: [
    { motorista: 'Ana', setorAtual: 'Motoristas', he1min: 120, he2min: 30, batidas: ['08:00'], interjornada: 'alerta' },
    { motorista: 'Bia', setorAtual: 'Reserva', he3min: 20, feriado: true }
  ] },
  { dateKey: '2026-10-27', items: [
    { motorista: 'Ana', setorAtual: 'Motoristas', he1min: 60, temLacuna: true },
    { motorista: 'Caio', setorAtual: 'ADM', he1min: 10, statusCruzamento: 'sem rastreador' }
  ] }
];

test('consulta um dia e soma HE e ocorrências daquele dia', () => {
  const result = consultarDia(snapshots, '2026-09-28');
  assert.equal(result.summary.he1min, 120);
  assert.equal(result.summary.he2min, 30);
  assert.equal(result.summary.he3min, 20);
  assert.equal(result.summary.interjornada, 1);
  assert.equal(result.summary.colaboradores, 2);
});

test('trabalho em feriado ou DSR entra como HE.3 mesmo sem excedente', () => {
  const result = consultarDia([{ dateKey: '2026-10-10', items: [{ motorista: 'Bia', he1min: 30, feriado: true }] }], '2026-10-10');
  assert.equal(result.items[0].he3min, 30);
  assert.equal(result.summary.he3min, 30);
});

test('agrega a competência sem duplicar colaboradores e permite filtrar setor', () => {
  const result = consultarPeriodo(snapshots, { inicio: '2026-09-28', fim: '2026-10-27' }, { setor: 'Motoristas' });
  assert.equal(result.summary.colaboradores, 1);
  assert.equal(result.summary.he1min, 180);
  assert.equal(result.summary.he2min, 30);
  assert.equal(result.diasProcessados, 2);
  assert.equal(result.porMotorista[0].motorista, 'Ana');
});

test('mantém o detalhe de cruzamento incompleto no resultado', () => {
  const result = consultarDia(snapshots, '2026-10-27');
  assert.equal(result.items[1].statusCruzamento, 'sem rastreador');
});

test('mostra meta diária, excedente e divisão dentro/acima do padrão cadastrado', () => {
  const result = consultarDia([{ dateKey: '2026-10-27', items: [
    { motorista: 'Ana', he1min: 45, padraoCadastradoMin: 30 },
    { motorista: 'Bia', he1min: 15, padraoCadastradoMin: 30 },
    { motorista: 'Caio', he1min: 10 }
  ] }], '2026-10-27', { metaDiaMin: 50 });
  assert.equal(result.summary.metaDiaMin, 50);
  assert.equal(result.summary.totalHEmin, 70);
  assert.equal(result.summary.excedenteVsMetaMin, 20);
  assert.equal(result.summary.heDentroPadraoMin, 45);
  assert.equal(result.summary.heAcimaPadraoMin, 15);
  assert.equal(result.summary.motoristasComHE, 3);
  assert.equal(result.summary.motoristasSemPadrao, 1);
});
