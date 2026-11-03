import test from 'node:test';
import assert from 'node:assert/strict';
import { createChecklistState, toggleAll, toggleOne } from './checklist-model.js';

const items = [{ id: 'a', motorista: 'Ana' }, { id: 'b', motorista: 'Bruno' }];

test('começa com todos os casos pendentes', () => {
  assert.deepEqual(createChecklistState(items).validatedIds, []);
});

test('valida todos os casos de uma vez', () => {
  assert.deepEqual(toggleAll(createChecklistState(items), items).validatedIds, ['a', 'b']);
});

test('desmarca apenas o caso selecionado', () => {
  const state = toggleAll(createChecklistState(items), items);
  assert.deepEqual(toggleOne(state, 'a').validatedIds, ['b']);
});
