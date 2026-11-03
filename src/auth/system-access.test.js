import test from 'node:test';
import assert from 'node:assert/strict';
import { canAccessSystem, getSystemAccess } from './system-access.js';

test('administrador acessa Jornada360 e Férias', () => {
  assert.deepEqual(getSystemAccess('OPERACIONAL4@TRANSPINHO.COM'), { admin: true, jornada: true, ferias: true });
});

test('RH acessa férias sem receber papel de administrador', () => {
  assert.equal(canAccessSystem('rh@transpinho.com', 'ferias'), true);
  assert.equal(getSystemAccess('rh@transpinho.com').admin, false);
});

test('e-mail desconhecido não acessa sistemas', () => {
  assert.equal(canAccessSystem('externo@example.com', 'ferias'), false);
  assert.equal(canAccessSystem('', 'jornada'), false);
});
