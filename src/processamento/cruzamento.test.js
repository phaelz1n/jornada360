import test from 'node:test';
import assert from 'node:assert/strict';
import { crossSources } from './cruzamento.js';

test('cruza ponto, escala e rastreador pelo nome normalizado', () => {
  const [row] = crossSources({ pointRows: [{ motorista: ' Ana   Silva ', he1min: 30 }], scaleRows: [{ nome: 'ANA SILVA', horario: '08:00' }], trackerRows: [{ colaborador: 'Ana Silva', sinais: 4 }] });
  assert.equal(row.statusCruzamento, 'completo');
  assert.equal(row.escala.horario, '08:00');
  assert.equal(row.rastreio.sinais, 4);
});

test('classifica fonte ausente sem descartar o ponto', () => assert.equal(crossSources({ pointRows: [{ motorista: 'Bia' }] })[0].statusCruzamento, 'sem correspondência'));
test('aceita nome abreviado quando há uma única correspondência segura', () => {
  const [row] = crossSources({ pointRows: [{ motorista: 'Cristiano Barreto' }], scaleRows: [{ nome: 'Cristiano Francisco Barreto', horario: '16:30' }] });
  assert.equal(row.statusCruzamento, 'sem rastreador');
  assert.equal(row.escala.horario, '16:30');
});
