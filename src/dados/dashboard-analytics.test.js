import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDashboardAnalytics } from './dashboard-analytics.js';

const snapshots = [
  { dateKey: '2026-10-27', items: [
    { motorista: 'Ana', setorAtual: 'Operação', he1min: 60, he2min: 20, he3min: 0, metaDiaMin: 50, interjornada: true },
    { motorista: 'Bia', setorAtual: 'RH', he1min: 0, he2min: 0, he3min: 30, metaDiaMin: 20, intrajornada: true }
  ] },
  { dateKey: '2026-10-28', items: [
    { motorista: 'Ana', setorAtual: 'Operação', he1min: 120, he2min: 0, he3min: 0, metaDiaMin: 50, foraDaEscalaProblema: true }
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
  assert.deepEqual(result.bucketComposition, { he1min: 180, he2min: 20, he3min: 30, totalHEmin: 230 });
  assert.equal(result.driverDistribution[0].motorista, 'Ana');
  assert.equal(result.driverDistribution[0].totalHEmin, 200);
  assert.equal(result.sectorComparison[0].setor, 'Operação');
  assert.equal(result.sectorComparison[0].totalHEmin, 200);
});

test('resume riscos operacionais sem duplicar o mesmo item', () => {
  const result = buildDashboardAnalytics({ report: { items: snapshots.flatMap(snapshot => snapshot.items), summary: {} }, snapshots });
  assert.deepEqual(result.riskMatrix, { interjornada: 1, intrajornada: 1, foraDaEscala: 1, semPadrao: 0, rastreioDivergente: 0 });
});

test('retorna coleções vazias e números finitos sem registros', () => {
  const result = buildDashboardAnalytics({ report: { items: [], summary: {} }, snapshots: [] });
  assert.deepEqual(result, { dailySeries: [], bucketComposition: { he1min: 0, he2min: 0, he3min: 0, totalHEmin: 0 }, driverDistribution: [], sectorComparison: [], riskMatrix: { interjornada: 0, intrajornada: 0, foraDaEscala: 0, semPadrao: 0, rastreioDivergente: 0 } });
});
