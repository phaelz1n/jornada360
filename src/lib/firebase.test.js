import test from 'node:test';
import assert from 'node:assert/strict';
import { firebaseConfig } from './firebase-config.js';

test('usa o projeto Firebase do Jornada360', () => {
  assert.equal(firebaseConfig.projectId, 'jornada360-3fb60');
});
