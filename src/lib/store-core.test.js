import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStore } from './store-core.js';

test('mantém uma implementação única de memória com cópia segura', async () => {
  const store = createMemoryStore({ 'motoristas/ana': { nome: 'Ana' } });
  const value = await store.get('motoristas/ana');
  value.nome = 'Alterada';
  assert.equal((await store.get('motoristas/ana')).nome, 'Ana');
  await store.merge('motoristas/ana', { setor: 'ADM' });
  assert.deepEqual(await store.get('motoristas/ana'), { nome: 'Ana', setor: 'ADM' });
});
