import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Vite usa o transformador React para componentes JSX', () => {
  const config = fs.readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');
  assert.match(config, /plugin-react/);
  assert.match(config, /react\(\)/);
});
