import test from 'node:test';
import assert from 'node:assert/strict';
import { detectColumns, extractPointRows, extractReportDate, extractScaleRows, extractStandardRows } from './planilha-normalizer.js';

test('reconhece cabeçalhos alternativos', () => assert.deepEqual(detectColumns(['Colaborador', 'Matrícula', 'HE 1', 'HE 2', 'HE 3']), { motorista: 0, batidas: -1, matricula: 1, he1min: 2, he2min: 3, he3min: 4 }));
test('converte horas extras HH:MM para minutos', () => assert.deepEqual(extractPointRows([['Nome', 'HE1', 'HE2'], ['Ana', '01:30', '00:20']]), [{ motorista: 'Ana', matricula: '', heBucketsExplicit: true, he1min: 90, he2min: 20, he3min: 0 }]));
test('extrai batidas para conferir o fim da jornada com o rastreador', () => assert.deepEqual(extractPointRows([['Nome', 'Entrada e Saída', 'HE1'], ['Ana', '08:00 12:00 13:00 18:30', '02:00']]), [{ motorista: 'Ana', matricula: '', batidas: ['08:00', '12:00', '13:00', '18:30'], heBucketsExplicit: true, he1min: 120, he2min: 0, he3min: 0 }]));
test('extrai a meta diária de extra do horário padrão', () => assert.deepEqual(extractStandardRows([['HORÁRIOS PADRÕES'], ['Nome', 'Horário 1', 'EXTRA'], ['Ana', '08:00:00', '00:10:00']]), [{ motorista: 'Ana', extraNormalPadrao: 10, horarios: ['08:00:00'] }]));
test('reconhece padrão quando a coluna se chama Motorista', () => assert.deepEqual(extractStandardRows([['Motorista', 'Horário 1', 'EXTRA'], ['Ademar Monteiro', '21:25-00:30', '00:10:00']]), [{ motorista: 'Ademar Monteiro', extraNormalPadrao: 10, horarios: ['21:25-00:30'] }]));
test('lê extra negativa do padrão sem descartar a extra positiva', () => assert.deepEqual(extractStandardRows([['HORÁRIOS PADRÕES'], ['Nome', 'Horário 1', 'EXTRA'], ['Ana', '08:00:00', '-00:10:00'], ['Bia', '08:00:00', '00:20:00']]), [{ motorista: 'Ana', extraNormalPadrao: -10, horarios: ['08:00:00'] }, { motorista: 'Bia', extraNormalPadrao: 20, horarios: ['08:00:00'] }]));
test('filtra a escala pelo dia do relatório principal', () => {
  const rows = [['Motorista', 'Data', 'Horário', 'Linha'], ['Ana', '27/10/2026', '16:30', 'Droga Raia'], ['Ana', '28/10/2026', '08:00', 'Outra']];
  assert.deepEqual(extractScaleRows(rows, '2026-10-27').map(row => row.linha), ['Droga Raia']);
});
test('identifica a data do espelho de ponto principal', () => assert.equal(extractReportDate([['Relatório de ponto', '27/10/2026'], ['Nome', 'Ana']]), '2026-10-27'));
