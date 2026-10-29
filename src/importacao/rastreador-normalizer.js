import { normalizeDriverName } from '../processamento/processamento-model.js';

function clean(value) {
  return String(value ?? '').trim();
}

function headerKey(value) {
  return clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

function timeOnly(value) {
  const match = clean(value).match(/(?:-|T| )(\d{1,2}:\d{2})/);
  return match?.[1] || '';
}

function number(value) {
  const parsed = Number(clean(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeTrackerRows(rows = []) {
  if (!rows.length) return [];
  const header = rows.find(row => row.some(cell => headerKey(cell).includes('motorista')) && row.some(cell => headerKey(cell).includes('data e horario da parada')));
  if (!header) return [];
  const index = Object.fromEntries(header.map((cell, position) => [headerKey(cell), position]));
  const find = (...names) => names.map(name => index[headerKey(name)]).find(value => value != null);
  const columns = {
    cobli: find('N° Cobli', 'Nº Cobli'), placa: find('Placa do veículo'), motorista: find('Motorista'), partida: find('Data e horário de partida'),
    parada: find('Data e horário da parada'), local: find('Local de interesse'), tipo: find('Tipo de local de interesse'), duracao: find('Tempo parado no local (min)'),
    enderecoParada: find('Endereço de parada'), link: find('Link do trajeto no mapa')
  };
  const groups = new Map();
  const lastDriverByVehicle = new Map();
  rows.slice(rows.indexOf(header) + 1).forEach(row => {
    const vehicle = clean(row[columns.placa]) || clean(row[columns.cobli]);
    if (!vehicle) return;
    const rawDriver = clean(row[columns.motorista]);
    const driver = rawDriver && rawDriver !== '--' ? rawDriver : lastDriverByVehicle.get(vehicle);
    if (!driver) return;
    const inherited = !rawDriver || rawDriver === '--';
    lastDriverByVehicle.set(vehicle, driver);
    const key = normalizeDriverName(driver);
    const group = groups.get(key) || { motorista: driver, placa: vehicle, paradas: [], trajetos: [], sinais: 0 };
    const partida = clean(row[columns.partida]);
    const parada = clean(row[columns.parada]);
    if (partida || parada) group.trajetos.push({ partida, parada, link: clean(row[columns.link]) });
    if (parada) group.paradas.push({ motoristaHerdado: inherited, horario: timeOnly(parada), duracaoMin: number(row[columns.duracao]), local: clean(row[columns.local]) || clean(row[columns.enderecoParada]), tipo: clean(row[columns.tipo]), endereco: clean(row[columns.enderecoParada]), dataHora: parada });
    group.sinais = group.trajetos.length;
    groups.set(key, group);
  });
  return [...groups.values()];
}
