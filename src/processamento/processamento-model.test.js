import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDriverName, prepareProcessedDay, summarizeDay } from './processamento-model.js';

test('normaliza nome para cruzamento', () => assert.equal(normalizeDriverName('  Ana   Silva '), 'ANA SILVA'));
test('consolida HE e ocorrências do dia', () => {
  const summary = summarizeDay([{ motorista: 'Ana', he1min: 10, he2min: 5, interjornada: 'alerta', setorAtual: 'Motoristas' }, { motorista: 'Bia', he3min: 8, temLacuna: true }]);
  assert.deepEqual(summary, { registros: 2, he1min: 10, he2min: 5, he3min: 8, interjornada: 1, intrajornada: 1, porSetor: { Motoristas: 1, 'Sem setor': 1 } });
});
test('prepara resultado persistível sem perder itens', () => {
  const result = prepareProcessedDay({ dateKey: '2026-10-29', items: [{ motorista: 'Ana', he1min: 12 }] });
  assert.equal(result.dateKey, '2026-10-29');
  assert.equal(result.items[0].setorAtual, 'Sem setor');
});
