import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVacationImportKey, parseVacationPdfText } from './pdf-import.js';

test('extrai funcionário, período aquisitivo, saldo e limite do relatório de férias', () => {
  const text = '04/12/2023 | MOISES WILLIAM NEUBERT | 1 | Período aquisitivo | 04/12/2024 | 03/12/2025 | Próximas férias: | 04/12/2024 | até | 03/12/2025 | 03/11/2026 | 14 | 0 | Programação de férias:';
  assert.deepEqual(parseVacationPdfText(text, 'import-1'), [{
    employeeCode: '', employeeName: 'MOISES WILLIAM NEUBERT', role: '', balanceDays: 14,
    gozoLimit: '2026-11-03', accrualPeriod: '04/12/2024 a 03/12/2025', sourceImportId: 'import-1'
  }]);
});

test('gera chave determinística para o mesmo conteúdo normalizado', () => {
  const records = [{ employeeName: 'Ana', balanceDays: 30, gozoLimit: '2026-12-01', accrualPeriod: '2025' }];
  assert.equal(buildVacationImportKey(records, 'previsao.pdf'), buildVacationImportKey(records, 'previsao.pdf'));
  assert.notEqual(buildVacationImportKey(records, 'previsao.pdf'), buildVacationImportKey(records, 'outro.pdf'));
});
