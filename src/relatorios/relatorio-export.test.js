import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReportCsv } from './relatorio-export.js';

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
