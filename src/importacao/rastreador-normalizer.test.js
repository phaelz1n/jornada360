import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTrackerRows } from './rastreador-normalizer.js';

const header = ['N° Cobli', 'Grupo', 'Placa do veículo', 'Apelido do veículo', 'Porte', 'Tags', 'Motorista', 'Endereço de partida', 'Data e horário de partida', 'Distância percorrida (Km)', 'Duração (min)', 'Endereço de parada', 'Data e horário da parada', 'Local de interesse', 'Tipo de local de interesse', 'Tempo parado no local (min)', 'Tempo de motor ocioso (min)', 'Gasto estimado (R$)', 'Link do trajeto no mapa', 'Observações'];

test('normaliza trajetos e paradas detalhadas por motorista', () => {
  const [row] = normalizeTrackerRows([header, ['XU1B', 'Micro', '1207', '--', 'Médio', '', 'ANA SILVA', 'Rua A', '28/10/2026 - 16:34', '10,2', '17', 'Rua B', '28/10/2026 - 16:51', 'Droga Raia', 'Cliente', '8', '2', '3,2', 'url', '--']]);
  assert.equal(row.motorista, 'ANA SILVA');
  assert.equal(row.placa, '1207');
  assert.equal(row.paradas[0].horario, '16:51');
  assert.equal(row.paradas[0].duracaoMin, 8);
  assert.equal(row.paradas[0].local, 'Droga Raia');
});

test('herda motorista em linhas sem nome do mesmo veículo e marca a origem', () => {
  const rows = [header,
    ['XU1B', 'Micro', '1207', '--', 'Médio', '', 'ANA SILVA', 'Rua A', '28/10/2026 - 16:34', '10,2', '17', 'Rua B', '28/10/2026 - 16:51', 'Base', 'Base', '8', '2', '3,2', 'url', '--'],
    ['XU1B', 'Micro', '1207', '--', 'Médio', '', '--', 'Rua B', '28/10/2026 - 17:00', '1,0', '5', 'Rua C', '28/10/2026 - 17:05', 'Cliente', 'Cliente', '3', '1', '1,0', 'url', '--']
  ];
  const [row] = normalizeTrackerRows(rows);
  assert.equal(row.paradas.length, 2);
  assert.equal(row.paradas[1].motoristaHerdado, true);
});
