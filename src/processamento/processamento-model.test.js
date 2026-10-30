import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDriverName, prepareProcessedDay, summarizeDay, splitExtraHours } from './processamento-model.js';

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
test('classifica o excedente acima de duas horas como HE.2', () => {
  assert.deepEqual(splitExtraHours(150), { he1min: 120, he2min: 30, he3min: 0 });
  assert.deepEqual(splitExtraHours(120), { he1min: 120, he2min: 0, he3min: 0 });
});
test('preserva HE.1, HE.2 e HE.3 quando vieram separados da planilha', () => {
  const result = prepareProcessedDay({ dateKey: '2026-10-27', items: [{ motorista: 'Ana', heBucketsExplicit: true, he1min: 2933, he2min: 131, he3min: 0 }] });
  assert.equal(result.items[0].he1min, 2933);
  assert.equal(result.items[0].he2min, 131);
  assert.equal(result.items[0].he3min, 0);
});
test('salva indicadores calculados no snapshot do dia', () => {
  const result = prepareProcessedDay({ dateKey: '2026-10-27', items: [{ motorista: 'Ana', heBucketsExplicit: true, he1min: 60, he2min: 30, padraoCadastradoMin: 60 }] });
  assert.equal(result.summary.totalHEmin, 90);
  assert.equal(result.summary.metaDiaMin, 60);
  assert.equal(result.summary.heDentroPadraoMin, 60);
  assert.equal(result.summary.heAcimaPadraoMin, 30);
});
test('remove dados pesados do rastreador antes de salvar o snapshot', () => {
  const result = prepareProcessedDay({ dateKey: '2026-10-27', items: [{ motorista: 'Ana', he1min: 30, rastreio: { trajetos: Array(100).fill({ ponto: 'x' }) }, paradasRastreador: [{ horario: '08:00', endereco: 'x' }], resumoRastreador: { total: 1 }, rastreadorStatus: 'confirmado' }] });
  assert.equal(result.items[0].rastreio, undefined);
  assert.equal(result.items[0].paradasRastreador, undefined);
  assert.equal(result.items[0].rastreadorStatus, 'confirmado');
  assert.deepEqual(result.items[0].resumoRastreador, { total: 1, novas: 0, possiveisTransitos: 0, confirmadas: 0 });
});
