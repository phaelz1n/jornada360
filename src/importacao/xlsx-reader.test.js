import test from 'node:test';
import assert from 'node:assert/strict';
import { readWorkbookRows } from './xlsx-reader.js';

test('lê linhas da primeira aba usando a API XLSX injetada', async () => {
  const file = { arrayBuffer: async () => new ArrayBuffer(8) };
  const XLSX = {
    read: (buffer, options) => {
      assert.equal(buffer.byteLength, 8);
      assert.deepEqual(options, { type: 'array', cellDates: true });
      return { SheetNames: ['Dados'], Sheets: { Dados: { rows: true } } };
    },
    utils: { sheet_to_json: (sheet, options) => { assert.equal(sheet.rows, true); assert.deepEqual(options, { header: 1, raw: false, defval: null }); return [['Nome'], ['Cristiano']]; } }
  };
  assert.deepEqual(await readWorkbookRows(file, XLSX), [['Nome'], ['Cristiano']]);
});

test('rejeita planilha sem arquivo', async () => {
  await assert.rejects(() => readWorkbookRows(null, {}), /Arquivo não informado/);
});
