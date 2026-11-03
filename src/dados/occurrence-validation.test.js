import test from 'node:test';
import assert from 'node:assert/strict';
import { validateOccurrence } from './occurrence-validation.js';

test('aceita ocorrência operacional válida', () => {
  assert.deepEqual(validateOccurrence({ dataKey: '2026-11-03', motorista: 'Adriano', tipo: 'Falta', minutos: 30, observacao: 'Consulta' }), { valid: true, errors: [] });
});

test('rejeita ocorrência com data, tipo ou minutos inválidos', () => {
  const result = validateOccurrence({ dataKey: '03/11/2026', motorista: 'Adriano', tipo: 'Outro', minutos: 1441 });
  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 3);
});
