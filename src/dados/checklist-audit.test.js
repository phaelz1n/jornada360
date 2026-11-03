import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChecklistAudit } from './checklist-audit.js';

test('resume a atualização do checklist sem copiar observações para o histórico', () => {
  const audit = buildChecklistAudit({ itemIds: ['a', 'b'], validatedIds: ['a'], details: { a: { causa: 'ajuste' } } }, '2026-11-03', 'rh@transpinho.com', '2026-11-03T10:00:00.000Z');
  assert.deepEqual(audit, {
    action: 'checklist_atualizado',
    dateKey: '2026-11-03',
    actorEmail: 'rh@transpinho.com',
    updatedAt: '2026-11-03T10:00:00.000Z',
    itemCount: 2,
    validatedCount: 1,
    detailCount: 1
  });
  assert.equal('details' in audit, false);
});
