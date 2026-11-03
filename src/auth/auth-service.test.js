import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureVerifiedUser } from './auth-service.js';

test('permite sessão encerrada ou usuário com e-mail verificado', () => {
  assert.equal(ensureVerifiedUser(null), null);
  const user = { emailVerified: true };
  assert.equal(ensureVerifiedUser(user), user);
});

test('rejeita usuário com e-mail não verificado', () => {
  assert.throws(() => ensureVerifiedUser({ emailVerified: false }), /E-mail não verificado/);
});
