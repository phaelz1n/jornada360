import test from 'node:test';
import assert from 'node:assert/strict';
import { getSectorPolicy } from './sector-rules.js';

test('centraliza política de ADM e aplica sábado reduzido', () => {
  const policy = getSectorPolicy('ADM', '2026-10-31');
  assert.equal(policy.trackerRequired, false);
  assert.equal(policy.standardRequired, false);
  assert.equal(policy.baseMinutes, 240);
});

test('centraliza política de Reserva com base de 7h20', () => {
  const policy = getSectorPolicy('Reserva', '2026-11-03');
  assert.equal(policy.trackerRequired, false);
  assert.equal(policy.standardRequired, false);
  assert.equal(policy.baseMinutes, 440);
});

test('mantém política padrão para setores não especiais', () => {
  const policy = getSectorPolicy('Motorista', '2026-11-03');
  assert.equal(policy.trackerRequired, true);
  assert.equal(policy.standardRequired, true);
  assert.equal(policy.baseMinutes, null);
});
