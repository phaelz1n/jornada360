import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDuplicateAliasMap, duplicateDriverError, findSimilarDriverNames, mergeDuplicateDrivers, normalizeDriverKey, duplicatePairKey, preferDuplicateKeep, resolveDuplicateName } from './motoristas-duplicates.js';

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

test('não sinaliza novamente uma duplicidade já aceita', () => {
  const drivers = [{ nome: 'Carlos Silva' }, { nome: 'Carlos da Silva' }];
  assert.deepEqual(findSimilarDriverNames(drivers, [duplicatePairKey('Carlos Silva', 'Carlos da Silva')]), []);
});

test('resolve o nome antigo para o cadastro mantido após aceitar a duplicidade', () => {
  const aliases = buildDuplicateAliasMap([{ keepName: 'Adilson Fernando Abruzzi', removeName: 'Adilson Fernando Abruzzi Milanezi' }]);
  assert.equal(resolveDuplicateName('ADILSON FERNANDO ABRUZZI MILANEZI', aliases), 'Adilson Fernando Abruzzi');
});

test('prioriza o cadastro com horário padrão ao resolver a duplicidade', () => {
  const drivers = [
    { nome: 'Adilson Fernando Abruzzi Milanezi', horarios: [] },
    { nome: 'Adilson Fernando Abruzzi', horarios: ['08:00', '12:00'] }
  ];
  assert.deepEqual(preferDuplicateKeep(drivers, ['Adilson Fernando Abruzzi Milanezi', 'Adilson Fernando Abruzzi']), ['Adilson Fernando Abruzzi', 'Adilson Fernando Abruzzi Milanezi']);
});

test('preserva o id do Firebase ao consolidar cadastro com item da planilha', () => {
  const result = mergeDuplicateDrivers([
    { id: 'cadastro-adilson', nome: 'Adilson Fernando Abruzzi', horarios: [] }
  ], [
    { motorista: 'Adilson Fernando Abruzzi', padraoHorarios: ['08:00', '17:00'], padraoStatus: 'completo' }
  ]);
  assert.equal(result[0].driver.id, 'cadastro-adilson');
});

test('não confunde pessoas diferentes que compartilham apenas primeiro nome e sobrenome comum', () => {
  assert.deepEqual(findSimilarDriverNames([{ nome: 'Marcos Aurelio da Silva' }, { nome: 'Marcos Junior da Silva Nepomoceno' }]), []);
});

test('bloqueia novo cadastro com nome normalizado repetido, mas permite edição do próprio registro', () => {
  const drivers = [{ nome: 'João Pereira' }];
  assert.match(duplicateDriverError(drivers, ' JOAO  PEREIRA '), /Já existe/);
  assert.equal(duplicateDriverError(drivers, ' JOAO  PEREIRA ', 'João Pereira'), '');
});
