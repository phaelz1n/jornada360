import test from 'node:test';
import assert from 'node:assert/strict';
import { competenciaParaData, listarDatas } from './competencia.js';

test('27 de outubro pertence à competência de 28 de setembro a 27 de outubro', () => {
  assert.deepEqual(competenciaParaData('2026-10-27'), {
    inicio: '2026-09-28',
    fim: '2026-10-27',
    chave: '2026-09-28_2026-10-27',
    rotulo: '28/09/2026 a 27/10/2026'
  });
});

test('28 de outubro inicia a competência seguinte', () => {
  assert.equal(competenciaParaData('2026-10-28').chave, '2026-10-28_2026-11-27');
});

test('calcula fevereiro e virada de ano sem perder um dia', () => {
  assert.deepEqual(competenciaParaData('2028-02-27'), {
    inicio: '2028-01-28', fim: '2028-02-27', chave: '2028-01-28_2028-02-27', rotulo: '28/01/2028 a 27/02/2028'
  });
  assert.deepEqual(competenciaParaData('2027-01-05'), {
    inicio: '2026-12-28', fim: '2027-01-27', chave: '2026-12-28_2027-01-27', rotulo: '28/12/2026 a 27/01/2027'
  });
});

test('lista todas as datas inclusive início e fim', () => {
  const dates = listarDatas('2026-09-28', '2026-10-27');
  assert.equal(dates.length, 30);
  assert.equal(dates[0], '2026-09-28');
  assert.equal(dates.at(-1), '2026-10-27');
});
