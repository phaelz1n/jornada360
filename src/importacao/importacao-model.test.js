import test from 'node:test';
import assert from 'node:assert/strict';
import { IMPORT_SOURCES, createImportState, setSourceFile } from './importacao-model.js';

test('mantém as cinco fontes de importação na ordem operacional', () => {
  assert.deepEqual(IMPORT_SOURCES.map(source => source.id), [
    'espelhoHoje', 'escala', 'rastreador', 'horarioPadrao', 'espelhoOntem'
  ]);
  assert.equal(IMPORT_SOURCES.filter(source => source.required).length, 4);
});

test('atualiza uma fonte sem perder as demais', () => {
  const initial = createImportState();
  const file = { name: '27.xlsx', size: 1024, type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  const updated = setSourceFile(initial, 'escala', file);

  assert.equal(updated.files.escala.name, '27.xlsx');
  assert.equal(updated.files.espelhoHoje, null);
  assert.equal(updated.ready, false);
});

test('fica pronto somente quando todas as fontes obrigatórias foram selecionadas', () => {
  let state = createImportState();
  for (const source of IMPORT_SOURCES.filter(item => item.required)) {
    state = setSourceFile(state, source.id, { name: `${source.id}.xlsx`, size: 200 });
  }
  assert.equal(state.ready, true);
});
