import test from 'node:test';
import assert from 'node:assert/strict';
import { SECTION_CONTENT } from './sections.js';

test('oferece conteúdo para todos os grupos principais', () => {
  const labels = ['Início', 'Importação', 'Processamento', 'Checklist', 'Relatórios', 'Cadastros', 'Firebase'];
  assert.deepEqual(Object.keys(SECTION_CONTENT), labels);
  for (const label of labels) {
    assert.ok(SECTION_CONTENT[label].title);
    assert.ok(SECTION_CONTENT[label].description);
  }
});
