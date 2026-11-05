import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDashboardAnalytics, groupPeopleBySector } from './dashboard-analytics.js';

const snapshots = [
  { dateKey: '2026-10-27', items: [
    { motorista: 'Ana', setorAtual: 'Operação', he1min: 60, he2min: 20, he3min: 0, extraCandidataMin: 10, metaDiaMin: 50, interjornada: true },
    { motorista: 'Bia', setorAtual: 'RH', he1min: 0, he2min: 0, he3min: 30, metaDiaMin: 20, intrajornada: true }
  ] },
  { dateKey: '2026-10-28', items: [
    { motorista: 'Ana', setorAtual: 'Operação', he1min: 120, he2min: 0, he3min: 0, extraCandidataMin: 5, metaDiaMin: 50, foraDaEscalaProblema: true }
  ] }
];

test('cria série diária com total, buckets, padrão e meta', () => {
  const result = buildDashboardAnalytics({ report: { items: snapshots.flatMap(snapshot => snapshot.items), summary: {} }, snapshots });
  assert.deepEqual(result.dailySeries, [
    { dateKey: '2026-10-27', totalHEmin: 110, he1min: 60, he2min: 20, he3min: 30, dentroPadraoMin: 70, acimaPadraoMin: 40, metaMin: 70 },
    { dateKey: '2026-10-28', totalHEmin: 120, he1min: 120, he2min: 0, he3min: 0, dentroPadraoMin: 50, acimaPadraoMin: 70, metaMin: 50 }
  ]);
});

test('agrega composição por bucket, motoristas e setores em ordem decrescente', () => {
  const result = buildDashboardAnalytics({ report: { items: snapshots.flatMap(snapshot => snapshot.items), summary: {} }, snapshots });
  assert.deepEqual(result.bucketComposition, { he1min: 180, he2min: 20, he3min: 30, semPadraoMin: 0, totalHEmin: 230 });
  assert.equal(result.driverDistribution[0].motorista, 'Ana');
  assert.equal(result.driverDistribution[0].totalHEmin, 200);
  assert.equal(result.sectorComparison[0].setor, 'Operação');
  assert.equal(result.sectorComparison[0].totalHEmin, 200);
});

test('inclui extras sem padrão na composição e nos riscos', () => {
  const result = buildDashboardAnalytics({ report: { items: [{ motorista: 'Ademar', he1min: 660 }], summary: {} }, snapshots: [] });
  assert.equal(result.bucketComposition.semPadraoMin, 660);
  assert.equal(result.bucketComposition.totalHEmin, 660);
  assert.deepEqual(result.riskDetails.semPadrao, ['Ademar']);
  assert.equal(result.riskMatrix.semPadrao, 1);
});

test('não marca como sem padrão quem tem horários cadastrados e extra prevista zero', () => {
  const result = buildDashboardAnalytics({ report: { items: [{ motorista: 'Ademar', he1min: 60, padraoStatus: 'encontrado', padraoHorarios: ['08:00', '17:00'], padraoCadastradoMin: 0 }], summary: {} }, snapshots: [] });
  assert.equal(result.bucketComposition.semPadraoMin, 0);
  assert.equal(result.riskMatrix.semPadrao, 0);
});

test('resume riscos operacionais sem duplicar o mesmo item', () => {
  const result = buildDashboardAnalytics({ report: { items: snapshots.flatMap(snapshot => snapshot.items), summary: {} }, snapshots });
  assert.deepEqual(result.riskMatrix, { interjornada: 1, intrajornada: 1, foraDaEscala: 1, semPadrao: 0, rastreioDivergente: 0 });
  assert.deepEqual(result.riskDetails.interjornada, ['Ana']);
  assert.deepEqual(result.riskDetails.intrajornada, ['Bia']);
});

test('guarda evidência de interjornada com o dia anterior', () => {
  const result = buildDashboardAnalytics({
    report: { items: [{ motorista: 'Agnaldo', dateKey: '2026-10-28', batidas: ['21:00', '07:00'], interjornada: true }], summary: {} },
    snapshots: [{ dateKey: '2026-10-27', items: [{ motorista: 'Agnaldo', batidas: ['08:00', '19:00'] }] }]
  });
  assert.deepEqual(result.riskEvidence.interjornada[0], { motorista: 'Agnaldo', dateKey: '2026-10-28', batidas: ['21:00', '07:00'], previousDateKey: '2026-10-27', previousBatidas: ['08:00', '19:00'] });
});

test('retorna coleções vazias e números finitos sem registros', () => {
  const result = buildDashboardAnalytics({ report: { items: [], summary: {} }, snapshots: [] });
  assert.deepEqual(result, { dailySeries: [], bucketComposition: { he1min: 0, he2min: 0, he3min: 0, semPadraoMin: 0, totalHEmin: 0 }, driverDistribution: [], sectorComparison: [], riskMatrix: { interjornada: 0, intrajornada: 0, foraDaEscala: 0, semPadrao: 0, rastreioDivergente: 0 }, riskDetails: { interjornada: [], intrajornada: [], foraDaEscala: [], semPadrao: [], rastreioDivergente: [] }, riskEvidence: { interjornada: [], intrajornada: [], foraDaEscala: [], semPadrao: [], rastreioDivergente: [] } });
});

test('detalhamento por setor soma HE.1, HE.2 e HE.3', () => {
  const groups = groupPeopleBySector([
    { motorista: 'Ana', setor: 'Operação', he1min: 60, he2min: 30, he3min: 10 },
    { motorista: 'Ana', setor: 'Operação', he1min: 5, he2min: 0, he3min: 0 }
  ]);
  assert.deepEqual(groups.get('Operação'), [{ motorista: 'Ana', totalHEmin: 105, he1min: 65 }]);
});

test('aceita snapshots e motoristas em mapa sem quebrar o dashboard', () => {
  const result = buildDashboardAnalytics({ report: { items: [] }, snapshots: { dia: { dateKey: '2026-10-27', items: { ana: { motorista: 'Ana', he1min: 10 } } } }, motoristas: { ana: { nome: 'Ana', setor: 'ADM' } } });
  assert.equal(result.bucketComposition.totalHEmin, 10);
  assert.equal(result.sectorComparison[0].setor, 'ADM');
});

test('prioriza o setor atual do cadastro sobre o setor antigo do snapshot', () => {
  const result = buildDashboardAnalytics({
    report: { items: [{ motorista: 'Ana Silva', setorAtual: 'Operações', he1min: 60 }], summary: {} },
    motoristas: [{ nome: 'Ana Silva', setor: 'ADM' }]
  });
  assert.equal(result.sectorComparison[0].setor, 'ADM');
});
