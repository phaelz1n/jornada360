import test from 'node:test';
import assert from 'node:assert/strict';
import { duplicateDriverError, findSimilarDriverNames, mergeDuplicateDrivers, normalizeDriverKey } from './motoristas-duplicates.js';

test('normaliza acentos, caixa e espaços', () => assert.equal(normalizeDriverKey('  José   da  Silva '), 'JOSE DA SILVA'));

test('agrupa nomes exatamente iguais e preserva o cadastro mais completo', () => {
  const result = mergeDuplicateDrivers([
    { nome: 'José da Silva', setor: 'Motoristas', horarios: [], extraNormalPadrao: 0 },
    { nome: ' JOSE  DA SILVA ', setor: 'Motoristas', horarios: ['06:00', '10:00'], extraNormalPadrao: 20, padraoStatus: 'completo' }
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].duplicateCount, 2);
  assert.deepEqual(result[0].driver.horarios, ['06:00', '10:00']);
});

test('mantém nomes parecidos separados e sinaliza revisão', () => {
  const result = findSimilarDriverNames([{ nome: 'Carlos Silva' }, { nome: 'Carlos da Silva' }]);
  assert.deepEqual(result, [['Carlos Silva', 'Carlos da Silva']]);
});

test('bloqueia novo cadastro com nome normalizado repetido, mas permite edição do próprio registro', () => {
  const drivers = [{ nome: 'João Pereira' }];
  assert.match(duplicateDriverError(drivers, ' JOAO  PEREIRA '), /Já existe/);
  assert.equal(duplicateDriverError(drivers, ' JOAO  PEREIRA ', 'João Pereira'), '');
});
