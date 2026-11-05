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

test('consulta snapshots antigos com itens em mapa sem quebrar o dashboard', () => {
  const result = consultarDia({ dia: { dateKey: '2026-10-27', items: { ana: { motorista: 'Ana', he1min: 30 } } } }, '2026-10-27');
  assert.equal(result.summary.totalHEmin, 30);
  assert.equal(result.items[0].motorista, 'Ana');
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
test('não cria horas acima do real quando o padrão cadastrado é negativo', () => {
  const result = consultarDia([{ dateKey: '2026-10-27', items: [{ motorista: 'Ana', he1min: 78, he2min: 0, he3min: 0, padraoCadastradoMin: -5 }] }], '2026-10-27');
  assert.equal(result.summary.totalHEmin, 78);
  assert.equal(result.summary.heDentroPadraoMin, 0);
  assert.equal(result.summary.heAcimaPadraoMin, 0);
});
test('separa a HE prevista da HE excedente ao padrão', () => {
  const base = [{ dateKey: '2026-10-27', items: [{ motorista: 'Ana', he1min: 120, he2min: 0, he3min: 0, padraoCadastradoMin: 120 }] }];
  assert.equal(consultarDia(base, '2026-10-27').summary.heDentroPadraoMin, 120);
  assert.equal(consultarDia(base, '2026-10-27').summary.heAcimaPadraoMin, 0);
  const extra = [{ dateKey: '2026-10-27', items: [{ motorista: 'Ana', he1min: 120, he2min: 60, he3min: 0, padraoCadastradoMin: 120 }] }];
  assert.equal(consultarDia(extra, '2026-10-27').summary.totalHEmin, 180);
  assert.equal(consultarDia(extra, '2026-10-27').summary.heDentroPadraoMin, 120);
  assert.equal(consultarDia(extra, '2026-10-27').summary.heAcimaPadraoMin, 60);
});
test('calcula meta do período pela média diária dos padrões carregados', () => {
  const snapshots = [
    { dateKey: '2026-10-27', items: [{ motorista: 'Ana', he1min: 60, metaDiaMin: 60 }] },
    { dateKey: '2026-10-28', items: [{ motorista: 'Ana', he1min: 120, metaDiaMin: 120 }] },
  ];
  const result = consultarPeriodo(snapshots, { inicio: '2026-10-27', fim: '2026-10-28' });
  assert.equal(result.summary.metaMediaDiariaMin, 90);
  assert.equal(result.summary.metaPeriodoMin, 180);
  assert.equal(result.summary.excedenteVsMetaMin, 0);
});
test('desconsidera padrões negativos na meta do período', () => {
  const result = consultarPeriodo([{ dateKey: '2026-10-27', items: [{ motorista: 'Ana', he1min: 60, metaDiaMin: -10 }, { motorista: 'Bia', he1min: 60, metaDiaMin: 20 }] }], { inicio: '2026-10-27', fim: '2026-10-27' });
  assert.equal(result.summary.metaPeriodoMin, 20);
});

test('não soma extras candidatas removidas do relatório', () => {
  const result = consultarDia([{ dateKey: '2026-10-27', items: [{ motorista: 'Ademar', he1min: 0, extraCandidataMin: 25, extraAuditoriaStatus: 'sem-escala-sem-rastreio', padraoCadastradoMin: -25 }] }], '2026-10-27');
  assert.equal(result.summary.totalHEmin, 0);
  assert.equal(result.summary.extraCandidataMin, undefined);
  assert.equal(result.items[0].extraCandidataMin, undefined);
});

test('não duplica HE removida no total fora do padrão', () => {
  const result = consultarDia([{ dateKey: '2026-10-27', items: [{ motorista: 'Ana', he1min: 60, heAcimaPadraoMin: 60, extraCandidataMin: 60, padraoStatus: 'encontrado', padraoCadastradoMin: 0, padraoHorarios: ['08:00', '17:00'] }] }], '2026-10-27');
  assert.equal(result.summary.extraCandidataMin, undefined);
  assert.equal(result.summary.foraPadraoAuditoriaMin, 60);
});

test('usa o setor atual do cadastro ao montar o resumo por setor', () => {
  const result = consultarPeriodo([{ dateKey: '2026-10-27', items: [{ motorista: 'Ana Silva', setorAtual: 'Operações', he1min: 60 }] }], { inicio: '2026-10-27', fim: '2026-10-27' }, {}, { 'ANA SILVA': { nome: 'Ana Silva', setor: 'ADM' } });
  assert.deepEqual(Object.keys(result.summary.porSetorDetalhado), ['ADM']);
});

test('filtra relatório por rastreio divergente e por HE fora do padrão', () => {
  const snapshots = [{ dateKey: '2026-10-27', items: [
    { motorista: 'Ana', he1min: 60, padraoCadastradoMin: 30, heAcimaPadraoMin: 30, rastreadorStatus: 'divergente' },
    { motorista: 'Bia', he1min: 60, padraoCadastradoMin: 60, rastreadorStatus: 'confirmado' }
  ] }];
  const rastreio = consultarDia(snapshots, '2026-10-27', { categoria: 'Rastreio divergente' });
  assert.deepEqual(rastreio.items.map(item => item.motorista), ['Ana']);
  const fora = consultarDia(snapshots, '2026-10-27', { categoria: 'Fora do padrão' });
  assert.deepEqual(fora.items.map(item => item.motorista), ['Ana']);
});

test('não inclui motorista sem HE no relatório de horas fora do padrão', () => {
  const result = consultarDia([{ dateKey: '2026-10-27', items: [
    { motorista: 'Jonas', he1min: 0, extraCandidataMin: 30, padraoStatus: 'encontrado', padraoCadastradoMin: 20, padraoHorarios: ['08:00', '17:00'] },
    { motorista: 'Marcos Viegas', he1min: 20, padraoStatus: 'encontrado', padraoCadastradoMin: 10, padraoHorarios: ['08:00', '17:00'] }
  ] }], '2026-10-27', { categoria: 'Fora do padrão' });
  assert.deepEqual(result.items.map(item => item.motorista), ['Marcos Viegas']);
});

test('ignora até quatro minutos fora do padrão no relatório e na soma', () => {
  const result = consultarDia([{ dateKey: '2026-10-27', items: [
    { motorista: 'Ana', he1min: 64, padraoStatus: 'encontrado', padraoCadastradoMin: 60, padraoHorarios: ['08:00', '17:00'] },
    { motorista: 'Bia', he1min: 65, padraoStatus: 'encontrado', padraoCadastradoMin: 60, padraoHorarios: ['08:00', '17:00'] }
  ] }], '2026-10-27', { categoria: 'Fora do padrão' });
  assert.deepEqual(result.items.map(item => item.motorista), ['Bia']);
  assert.equal(result.summary.heAcimaPadraoMin, 5);
});

test('não reaplica resumo antigo quando os itens do snapshot foram corrigidos', () => {
  const result = consultarDia([{
    dateKey: '2026-10-27',
    items: [{ motorista: 'Marcos Viegas', heBucketsExplicit: true, he1min: 11, he2min: 0, he3min: 0, padraoCadastradoMin: 0 }],
    summary: { totalHEmin: 96, he1min: 96, he2min: 0, he3min: 0 }
  }], '2026-10-27');
  assert.equal(result.summary.totalHEmin, 11);
  assert.equal(result.summary.he1min, 11);
});

test('reaplica o padrão cadastrado ao consultar snapshots antigos', () => {
  const result = consultarPeriodo([
    { dateKey: '2026-10-27', items: [{ motorista: 'Ana Silva', batidas: ['08:00', '12:00', '13:00', '18:00'], he1min: 999 }] }
  ], { inicio: '2026-10-27', fim: '2026-10-27' }, {}, {
    'ANA SILVA': { nome: 'Ana Silva', horarios: ['08:00', '12:00', '13:00', '17:00'], extraNormalPadrao: 30, setor: 'Motoristas' }
  });
  assert.equal(result.summary.totalHEmin, 60);
  assert.equal(result.summary.heDentroPadraoMin, 30);
  assert.equal(result.summary.heAcimaPadraoMin, 30);
  assert.equal(result.summary.motoristasSemPadrao, 0);
});

test('usa cadastro completo quando existem registros duplicados do motorista', () => {
  const cadastro = {
    'ANA SILVA': { nome: 'Ana Silva', horarios: ['08:00', '12:00', '13:00', '17:00'], extraNormalPadrao: 0 }
  };
  const result = consultarDia([{ dateKey: '2026-10-27', items: [{ motorista: 'Ana Silva', batidas: ['08:00', '12:00', '13:00', '18:00'] }] }], '2026-10-27', {}, cadastro);
  assert.equal(result.summary.motoristasSemPadrao, 0);
  assert.equal(result.summary.totalHEmin, 60);
});

test('considera cadastrado o motorista com horários e extra prevista zero', () => {
  const result = consultarDia([
    { dateKey: '2026-10-27', items: [{ motorista: 'Bia', batidas: ['08:00', '12:00', '13:00', '17:00'] }] }
  ], '2026-10-27', {}, {
    'BIA': { nome: 'Bia', horarios: ['08:00', '12:00', '13:00', '17:00'], extraNormalPadrao: 0 }
  });
  assert.equal(result.summary.totalHEmin, 0);
  assert.equal(result.summary.semPadraoMin, 0);
  assert.equal(result.summary.motoristasSemPadrao, 0);
});

test('não inclui reserva, folguista ou cobre-férias no filtro fora do padrão nem no resumo', () => {
  const result = consultarDia([{ dateKey: '2026-11-04', items: [
    { motorista: 'Fixo', setorAtual: 'Motoristas', he1min: 60, padraoCadastradoMin: 0, heAcimaPadraoMin: 60 },
    { motorista: 'Reserva', setorAtual: 'Reserva', he1min: 120, padraoCadastradoMin: 0, heAcimaPadraoMin: 120 },
    { motorista: 'Cobre', setorAtual: 'Cobre férias', he1min: 120, padraoCadastradoMin: 0, heAcimaPadraoMin: 120 }
  ] }], '2026-11-04', { categoria: 'Fora do padrão' });
  assert.deepEqual(result.items.map(item => item.motorista), ['Fixo']);
  assert.equal(result.summary.totalHEmin, 60);
});
