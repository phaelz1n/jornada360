const aliases = {
  motorista: ['motorista', 'nome', 'colaborador', 'funcionario'],
  batidas: ['entradaesaida', 'batidas', 'batida', 'horarios'],
  matricula: ['matricula', 'codigo'],
  he1min: ['he1', 'horaextra1', 'extra1'],
  he2min: ['he2', 'horaextra2', 'extra2'],
  he3min: ['he3', 'horaextra3', 'extra3'],
};

function normalizeHeader(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function parseMinutes(value) {
  if (value instanceof Date) return value.getHours() * 60 + value.getMinutes();
  if (typeof value === 'number') return Math.round(value * 24 * 60);
  const text = String(value || '').trim();
  if (!text) return 0;
  const match = text.match(/^(\d+):([0-5]\d)(?::[0-5]\d)?$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : Number(text.replace(',', '.')) || 0;
}

export function detectColumns(header = []) {
  const normalized = header.map(normalizeHeader);
  return Object.fromEntries(Object.entries(aliases).map(([key, options]) => [key, normalized.findIndex(value => options.includes(value))]));
}

export function extractPointRows(rows = []) {
  if (!rows.length) return [];
  const columns = detectColumns(rows[0]);
  return rows.slice(1).map(row => ({
    motorista: String(row[columns.motorista] || '').trim(),
    matricula: String(row[columns.matricula] || '').trim(),
    ...(columns.batidas >= 0 ? { batidas: String(row[columns.batidas] || '').match(/\b\d{1,2}:\d{2}\b/g) || [] } : {}),
    ...(columns.he1min >= 0 || columns.he2min >= 0 || columns.he3min >= 0 ? { heBucketsExplicit: true } : {}),
    he1min: parseMinutes(row[columns.he1min]),
    he2min: parseMinutes(row[columns.he2min]),
    he3min: parseMinutes(row[columns.he3min]),
  })).filter(row => row.motorista);
}

export function extractStandardRows(rows = []) {
  const headerIndex = rows.findIndex(row => row.some(cell => normalizeHeader(cell) === 'nome') && row.some(cell => normalizeHeader(cell).includes('extra')));
  if (headerIndex < 0) return [];
  const header = rows[headerIndex].map(normalizeHeader);
  const nameColumn = header.findIndex(value => value === 'nome');
  const extraColumn = header.findIndex(value => value.includes('extra'));
  return rows.slice(headerIndex + 1).map(row => ({ motorista: String(row[nameColumn] || '').trim(), extraNormalPadrao: parseMinutes(row[extraColumn]) })).filter(row => row.motorista);
}
