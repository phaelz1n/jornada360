import test from 'node:test';
import assert from 'node:assert/strict';
import { NAVIGATION_GROUPS } from './navigation.js';

test('organiza a operação em grupos de navegação', () => {
  assert.deepEqual(NAVIGATION_GROUPS.map(group => group.label), [
    'Início', 'Importação', 'Processamento', 'Checklist', 'Relatórios', 'Cadastros', 'Firebase'
  ]);
});
