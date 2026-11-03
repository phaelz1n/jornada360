import test from 'node:test';
import assert from 'node:assert/strict';
import { durationFromPairs, nextDateKey, parseTimeMinutes } from './time-utils.js';

test('interpreta horários e atravessa meia-noite', () => {
  assert.equal(parseTimeMinutes('21:36'), 1296);
  assert.equal(parseTimeMinutes('00:37'), 37);
  assert.equal(durationFromPairs(['21:36', '00:37', '03:41', '05:52']), 312);
});

test('calcula o dia seguinte sem deslocamento de fuso', () => {
  assert.equal(nextDateKey('2026-12-31'), '2027-01-01');
});
