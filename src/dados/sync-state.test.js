import test from 'node:test';
import assert from 'node:assert/strict';
import { syncLabel, syncTone } from './sync-state.js';

test('descreve estados de sincronização para a interface', () => {
  assert.equal(syncLabel('idle'), 'Firebase conectado');
  assert.equal(syncLabel('saving'), 'Salvando no Firebase…');
  assert.equal(syncLabel('saved'), 'Sincronizado');
  assert.equal(syncLabel('error'), 'Falha na sincronização');
  assert.equal(syncTone('error'), 'error');
});
