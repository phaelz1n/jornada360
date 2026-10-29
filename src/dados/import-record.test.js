import test from 'node:test';
import assert from 'node:assert/strict';
import { buildImportRecord } from './import-record.js';

test('serializa somente metadados seguros das planilhas', () => {
  const result = buildImportRecord({
    files: { escala: { name: '27.xlsx', size: 1200, lastModified: 100 } },
    rows: { escala: 220 },
    dateKey: '2026-10-29'
  });
  assert.equal(result.dateKey, '2026-10-29');
  assert.equal(result.files.escala.name, '27.xlsx');
  assert.equal(result.files.escala.rows, 220);
  assert.equal(result.files.escala.size, 1200);
});
