import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDriverStandard, driverToStandardRow, mergeDriverStandardRows, normalizeDriverName, prepareProcessedDay, summarizeDay, splitExtraHours } from './processamento-model.js';

test('normaliza nome para cruzamento', () => assert.equal(normalizeDriverName('  Ana   Silva '), 'ANA SILVA'));
test('normaliza acentos para cruzar nomes entre planilhas', () => assert.equal(normalizeDriverName('JOSÉ WEBER'), 'JOSE WEBER'));
test('consolida HE e ocorrências do dia', () => {
  const summary = summarizeDay([{ motorista: 'Ana', he1min: 10, he2min: 5, interjornada: 'alerta', setorAtual: 'Motoristas' }, { motorista: 'Bia', he3min: 8, temLacuna: true }]);
  assert.deepEqual(summary, { registros: 2, he1min: 10, he2min: 5, he3min: 8, interjornada: 1, intrajornada: 1, porSetor: { Motoristas: 1, 'Sem setor': 1 } });
});
test('prepara resultado persistível sem perder itens', () => {
  const result = prepareProcessedDay({ dateKey: '2026-10-29', items: [{ motorista: 'Ana', he1min: 12 }] });
  assert.equal(result.dateKey, '2026-10-29');
  assert.equal(result.items[0].setorAtual, 'Sem setor');
});
test('reutiliza setor salvo no cadastro ao preparar nova importação', () => {
  const result = prepareProcessedDay({ dateKey: '2026-10-29', cadastro: { 'ANA SILVA': { nome: 'Ana Silva', setor: 'ADM' } }, items: [{ motorista: 'Ana Silva', he1min: 12 }] });
  assert.equal(result.items[0].setorAtual, 'ADM');
  assert.equal(result.summary.porSetor.ADM, 1);
});
test('substitui setor antigo pelo setor atual do cadastro ao preparar o snapshot', () => {
  const result = prepareProcessedDay({ dateKey: '2026-10-29', cadastro: { 'ANA SILVA': { nome: 'Ana Silva', setor: 'ADM' } }, items: [{ motorista: 'Ana Silva', setorAtual: 'Operações', setor: 'Operações', he1min: 12 }] });
  assert.equal(result.items[0].setorAtual, 'ADM');
});
test('classifica o excedente acima de duas horas como HE.2', () => {
  assert.deepEqual(splitExtraHours(150), { he1min: 120, he2min: 30, he3min: 0 });
  assert.deepEqual(splitExtraHours(120), { he1min: 120, he2min: 0, he3min: 0 });
});
test('preserva HE.1, HE.2 e HE.3 quando vieram separados da planilha', () => {
  const result = prepareProcessedDay({ dateKey: '2026-10-27', items: [{ motorista: 'Ana', heBucketsExplicit: true, he1min: 2933, he2min: 131, he3min: 0 }] });
  assert.equal(result.items[0].he1min, 2933);
  assert.equal(result.items[0].he2min, 131);
  assert.equal(result.items[0].he3min, 0);
});
test('salva indicadores calculados no snapshot do dia', () => {
  const result = prepareProcessedDay({ dateKey: '2026-10-27', items: [{ motorista: 'Ana', heBucketsExplicit: true, he1min: 60, he2min: 30, padraoCadastradoMin: 60 }] });
  assert.equal(result.summary.totalHEmin, 90);
  assert.equal(result.summary.metaDiaMin, 60);
  assert.equal(result.summary.heDentroPadraoMin, 60);
  assert.equal(result.summary.heAcimaPadraoMin, 30);
});
test('remove dados pesados do rastreador antes de salvar o snapshot', () => {
  const result = prepareProcessedDay({ dateKey: '2026-10-27', items: [{ motorista: 'Ana', he1min: 30, rastreio: { trajetos: Array(100).fill({ ponto: 'x' }) }, paradasRastreador: [{ horario: '08:00', endereco: 'x' }], resumoRastreador: { total: 1 }, rastreadorStatus: 'confirmado' }] });
  assert.equal(result.items[0].rastreio, undefined);
  assert.equal(result.items[0].paradasRastreador, undefined);
  assert.equal(result.items[0].rastreadorStatus, 'confirmado');
  assert.deepEqual(result.items[0].resumoRastreador, { total: 1, novas: 0, possiveisTransitos: 0, confirmadas: 0 });
});

test('converte padrão cadastrado do motorista para fonte de cálculo', () => {
  assert.deepEqual(driverToStandardRow({ nome: 'Ana Silva', horarios: ['08:00', '17:00'], extraNormalPadrao: 30 }), {
    motorista: 'Ana Silva',
    extraNormalPadrao: 30,
    horarios: ['08:00', '17:00']
  });
});

test('mantém motorista cadastrado sem padrão como registro pendente', () => {
  assert.deepEqual(driverToStandardRow({ nome: 'Bia', setor: 'Motoristas' }), {
    motorista: 'Bia',
    extraNormalPadrao: 0,
    horarios: []
  });
});

test('recalcula o padrão de um snapshot quando o cadastro é atualizado', () => {
  const item = applyDriverStandard({ motorista: 'Ana', batidas: ['08:00', '12:00', '13:00', '18:00'] }, { nome: 'Ana', horarios: ['08:00', '12:00', '13:00', '17:00'], extraNormalPadrao: 30 });
  assert.equal(item.totalHE, 60);
  assert.equal(item.heDentroPadraoMin, 30);
  assert.equal(item.heAcimaPadraoMin, 30);
  assert.equal(item.padraoStatus, 'encontrado');
  assert.equal(item.jornadaPrevistaMin, 480);
});

test('preserva HE oficial ao reaplicar padrão em snapshot noturno', () => {
  const item = applyDriverStandard({ motorista: 'Marcos Viegas da Cruz', batidas: ['17:00', '20:04', '20:51', '22:23', '00:30', '02:25', '03:00', '04:00'], he1min: 11, he2min: 0, he3min: 0 }, { nome: 'Marcos Viegas da Cruz', horarios: ['17:10', '20:00', '23:20', '00:45', '00:50', '02:30'], extraNormalPadrao: 0 });
  assert.equal(item.totalHE, 11);
  assert.equal(item.heAcimaPadraoMin, 11);
});

test('mescla a planilha de migração no cadastro sem apagar o setor existente', () => {
  const drivers = mergeDriverStandardRows([{ nome: 'Ana Silva', setor: 'ADM', horarios: [] }], [{ motorista: 'Ana Silva', horarios: ['08:00', '17:00'], extraNormalPadrao: 30 }, { motorista: 'Bia', horarios: ['07:00', '16:00'], extraNormalPadrao: 0 }]);
  assert.deepEqual(drivers, [
    { nome: 'Ana Silva', setor: 'ADM', horarios: ['08:00', '17:00'], extraNormalPadrao: 30, padraoStatus: 'completo' },
    { nome: 'Bia', setor: 'Sem setor', horarios: ['07:00', '16:00'], extraNormalPadrao: 0, padraoStatus: 'completo' }
  ]);
});

test('aceita cadastro vindo como mapa sem quebrar a tela', () => {
  const drivers = mergeDriverStandardRows({ ana: { nome: 'Ana', setor: 'ADM' } }, { ana: { motorista: 'Ana', horarios: ['08:00', '17:00'], extraNormalPadrao: 0 } });
  assert.equal(drivers[0].padraoStatus, 'completo');
});

test('prepara itens antigos em mapa sem falhar no processamento', () => {
  const result = prepareProcessedDay({ dateKey: '2026-10-27', items: { ana: { motorista: 'Ana', he1min: 10 } } });
  assert.equal(result.items[0].motorista, 'Ana');
});
