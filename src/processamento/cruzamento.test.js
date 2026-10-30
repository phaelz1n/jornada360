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

test('anexa a análise das paradas do rastreador ao cruzamento', () => {
  const [row] = crossSources({
    pointRows: [{ motorista: 'Ana', batidas: ['16:32', '20:05'] }],
    scaleRows: [{ nome: 'Ana', inicio: '16:30', fim: '20:00', linha: 'Droga Raia' }],
    trackerRows: [{ colaborador: 'Ana', paradas: [{ horario: '16:34', duracaoMin: 8, local: 'Droga Raia' }] }]
  });
  assert.equal(row.paradasRastreador[0].status, 'confirmada');
  assert.equal(row.paradasRastreador[0].linha, 'Droga Raia');
});

test('usa a coluna EXTRA individual do horário padrão', () => {
  const [row] = crossSources({
    pointRows: [{ motorista: 'Ana', he1min: 120, he2min: 60, he3min: 0 }],
    standardRows: [{ motorista: 'Ana', extraNormalPadrao: 120, horarios: ['08:00:00'] }]
  });
  assert.equal(row.padraoCadastradoMin, 120);
  assert.equal(row.metaDiaMin, 120);
});

test('separa extra dentro e fora do padrão e informa evidência do rastreador', () => {
  const [row] = crossSources({
    pointRows: [{ motorista: 'Ademir Monteiro', totalHE: 30, he1min: 30, batidas: ['08:00', '12:30'] }],
    standardRows: [{ motorista: 'Ademir Monteiro', extraNormalPadrao: 10, horarios: ['08:00'] }],
    trackerRows: [{ colaborador: 'Ademir Monteiro', paradas: [{ horario: '12:20', duracaoMin: 20 }] }]
  });
  assert.equal(row.heDentroPadraoMin, 10);
  assert.equal(row.heAcimaPadraoMin, 20);
  assert.equal(row.evidenciaRastreador[0].status, 'confirmada');
  assert.equal(row.rastreadorStatus, 'confirmado');
});

test('marca possível padrão incorreto após cinco dias consistentes', () => {
  const [row] = crossSources({
    pointRows: [{ motorista: 'Ademir Monteiro', totalHE: 30, he1min: 30 }],
    standardRows: [{ motorista: 'Ademir Monteiro', extraNormalPadrao: 10 }],
    trackerRows: [{ colaborador: 'Ademir Monteiro', paradas: [{ horario: '12:20', duracaoMin: 20 }] }],
    patternHistory: { 'ADEMIR MONTEIRO': [30, 30, 30, 30, 30] }
  });
  assert.equal(row.padraoSuspeito, true);
});
