import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialReportState, updateReportFilter } from './relatorio-state.js';

test('inicia no modo diário com filtros neutros', () => {
  assert.deepEqual(createInitialReportState('2026-10-27'), {
    mode: 'dia', dateKey: '2026-10-27', periodKey: '', motorista: '', setor: 'Todos', categoria: 'Todos'
  });
});

test('altera filtros sem perder os demais valores', () => {
  const state = createInitialReportState('2026-10-27');
  assert.deepEqual(updateReportFilter(state, { mode: 'periodo', setor: 'Motoristas' }), {
    mode: 'periodo', dateKey: '2026-10-27', periodKey: '', motorista: '', setor: 'Motoristas', categoria: 'Todos'
  });
});
