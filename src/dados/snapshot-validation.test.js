import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSnapshot } from './snapshot-validation.js';

test('valida a estrutura mínima de um snapshot', () => {
  assert.deepEqual(validateSnapshot({ dateKey: '2026-11-03', items: [] }), { valid: true, errors: [] });
});

test('informa todos os campos inválidos do snapshot', () => {
  const result = validateSnapshot({ dateKey: '03/11/2026', items: {} });
  assert.equal(result.valid, false);
  assert.deepEqual(result.errors, ['dateKey deve estar no formato YYYY-MM-DD', 'items deve ser uma lista']);
});
