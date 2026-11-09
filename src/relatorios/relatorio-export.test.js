import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReportCsv, formatReportTimes } from './relatorio-export.js';

test('exporta a data de cada registro no relatório CSV', () => {
  const csv = buildReportCsv([{
    dateKey: '2026-11-05',
    motorista: 'Aldemir Nascimento Paz',
    setorAtual: 'Motorista',
    batidas: ['16:32'],
    padraoHorarios: ['16:45'],
  }]);

  assert.match(csv, /^"Data";"Motorista"/);
  assert.match(csv, /"2026-11-05";"Aldemir Nascimento Paz"/);
});

test('exporta registros legados com horários salvos como texto', () => {
  const csv = buildReportCsv([{
    dateKey: '2026-11-06',
    motorista: 'Maria Silvana Goncalves',
    batidas: '08:00 · 12:00',
    padraoHorarios: '08:00 · 12:00',
  }]);

  assert.match(csv, /"2026-11-06";"Maria Silvana Goncalves"/);
  assert.match(csv, /"08:00 · 12:00"/);
});

test('formata horários opcionais sem chamar join em valor ausente ou textual', () => {
  assert.equal(formatReportTimes(undefined), '');
  assert.equal(formatReportTimes('08:00 · 12:00'), '08:00 · 12:00');
  assert.equal(formatReportTimes(['08:00', '12:00']), '08:00 · 12:00');
});
