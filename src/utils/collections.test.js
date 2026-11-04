import test from 'node:test';
import assert from 'node:assert/strict';
import { asArray } from './collections.js';

test('converte coleção legada em mapa para lista antes de renderizar', () => {
  assert.deepEqual(asArray({ a: { horario: '08:00' } }), [{ horario: '08:00' }]);
  assert.deepEqual(asArray(null), []);
});
