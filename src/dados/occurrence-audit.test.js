import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOccurrenceAudit } from './occurrence-audit.js';

test('resume ocorrência criada no histórico sem copiar a observação', () => {
  const audit = buildOccurrenceAudit({ dataKey: '2026-11-03', tipo: 'Atestado', minutos: 90, observacao: 'dado interno' }, 'rh@transpinho.com', '2026-11-03T10:00:00.000Z');
  assert.deepEqual(audit, { action: 'ocorrencia_criada', dateKey: '2026-11-03', actorEmail: 'rh@transpinho.com', createdAt: '2026-11-03T10:00:00.000Z', occurrenceType: 'Atestado', minutes: 90 });
  assert.equal('observacao' in audit, false);
});
