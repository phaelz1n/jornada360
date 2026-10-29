import test from 'node:test';
import assert from 'node:assert/strict';
import { analisarParadasRastreador } from './rastreador-analysis.js';

test('identifica parada do rastreador próxima da linha da escala', () => {
  const result = analisarParadasRastreador({
    batidas: ['16:32', '20:05'],
    escala: [{ inicio: '16:30', fim: '20:00', linha: 'Droga Raia' }],
    rastreador: { paradas: [{ horario: '16:34', duracaoMin: 8, local: 'Droga Raia' }] }
  });
  assert.equal(result.paradas[0].status, 'confirmada');
  assert.equal(result.paradas[0].linha, 'Droga Raia');
  assert.equal(result.paradas[0].diferencaMin, 4);
});

test('mostra parada fora do padrão como possível trânsito quando a escala e o rastreador batem', () => {
  const result = analisarParadasRastreador({
    batidas: ['08:00', '19:25'],
    escala: [{ inicio: '08:00', fim: '17:20', linha: 'Linha ADM' }],
    rastreador: { paradas: [{ horario: '18:10', duracaoMin: 12, local: 'Av. Brasil' }] }
  });
  assert.equal(result.paradas[0].status, 'possivel-transito');
  assert.equal(result.paradas[0].motivo, 'escala-e-rastreador-confirmam');
});

test('separa parada nova para cadastro de padrão', () => {
  const result = analisarParadasRastreador({
    escala: [{ inicio: '10:00', fim: '12:00', linha: 'Linha A' }],
    rastreador: { paradas: [{ horario: '13:45', duracaoMin: 20, local: 'Local novo' }] },
    paradasConhecidas: [{ local: 'Terminal', horario: '10:05' }]
  });
  assert.equal(result.paradas[0].status, 'nova');
  assert.equal(result.paradas[0].precisaCadastro, true);
});
