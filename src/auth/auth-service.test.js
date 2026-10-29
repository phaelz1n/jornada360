import test from 'node:test';
import assert from 'node:assert/strict';
import { AUTHORIZED_EMAILS, createAuthService } from './auth-service.js';

test('mantém os três e-mails autorizados', () => {
  assert.deepEqual(AUTHORIZED_EMAILS, [
    'operacional4@transpinho.com',
    'rh@transpinho.com',
    'tielle@transpinho.com'
  ]);
});

test('normaliza e-mail permitido antes de entrar', async () => {
  const calls = [];
  const service = createAuthService({
    auth: {},
    signIn: async (...args) => { calls.push(args); return { user: true }; },
    signOut: async () => {},
    subscribe: () => () => {}
  });

  await service.login(' RH@TRANSPINHO.COM ', 'senha');
  assert.deepEqual(calls, [[{}, 'rh@transpinho.com', 'senha']]);
});

test('rejeita e-mail fora da lista antes de chamar o Firebase', async () => {
  const service = createAuthService({
    auth: {},
    signIn: async () => assert.fail('não deveria chamar o Firebase'),
    signOut: async () => {},
    subscribe: () => () => {}
  });

  await assert.rejects(() => service.login('outro@empresa.com', 'senha'), /E-mail não autorizado/);
});

test('solicita redefinição somente para e-mail autorizado', async () => {
  const calls = [];
  const service = createAuthService({
    auth: {},
    signIn: async () => {},
    sendReset: async (...args) => { calls.push(args); },
    signOut: async () => {},
    subscribe: () => () => {}
  });

  await service.resetPassword(' TIELLE@TRANSPINHO.COM ');
  assert.deepEqual(calls, [[{}, 'tielle@transpinho.com']]);
  await assert.rejects(() => service.resetPassword('fora@empresa.com'), /E-mail não autorizado/);
});
