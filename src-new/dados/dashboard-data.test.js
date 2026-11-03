import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDashboardData } from './dashboard-data.js';

test('combina dados do Firebase com fallback local', async () => {
  const data = await buildDashboardData({
    store: { get: async path => path === 'snapshots_dias/latest' ? { items: [{ motorista: 'Ana' }] } : undefined },
    localBackup: { dias: [{ snapshot: { items: [{ motorista: 'Bruno' }] } }] }
  });
  assert.deepEqual(data.items, [{ motorista: 'Ana' }]);
  assert.equal(data.source, 'firebase');
});

test('usa o backup local quando o Firebase está vazio', async () => {
  const data = await buildDashboardData({ store: { get: async () => undefined }, localBackup: { dias: [{ snapshot: { items: [{ motorista: 'Bruno' }] } }] } });
  assert.deepEqual(data.items, [{ motorista: 'Bruno' }]);
  assert.equal(data.source, 'local');
});
