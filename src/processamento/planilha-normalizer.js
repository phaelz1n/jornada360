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
  const match = text.match(/^(-?)(\d+):([0-5]\d)(?::[0-5]\d)?$/);
  if (match) {
    const minutes = Number(match[2]) * 60 + Number(match[3]);
    return match[1] ? -minutes : minutes;
  }
  return Number(text.replace(',', '.')) || 0;
}

function parseDurationMinutes(value) {
  if (value instanceof Date) {
    const epoch = Date.UTC(1899, 11, 30);
    return Math.round((value.getTime() - epoch) / 60000);
  }
  return parseMinutes(value);
}

function formatTimeValue(value) {
  if (value instanceof Date) return `${String(value.getUTCHours()).padStart(2, '0')}:${String(value.getUTCMinutes()).padStart(2, '0')}`;
  if (typeof value === 'number') {
    const total = Math.round((value % 1) * 1440);
    return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }
  return String(value ?? '').trim();
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

export function extractReportDate(rows = []) {
  const text = rows.flat().map(value => String(value ?? '')).join(' ');
  const iso = text.match(/\b(20\d{2})[-\/](\d{2})[-\/](\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const brazilian = text.match(/\b(\d{2})[-\/](\d{2})[-\/](20\d{2})\b/);
  return brazilian ? `${brazilian[3]}-${brazilian[2]}-${brazilian[1]}` : '';
}

export function extractStandardRows(rows = []) {
  const isDriverHeader = value => ['nome', 'motorista', 'colaborador', 'funcionario', 'empregado'].includes(normalizeHeader(value));
  const isExtraHeader = value => {
    const key = normalizeHeader(value);
    return key.includes('extra') || key.includes('horaextra') || key === 'he' || /^he[123]$/.test(key) || key.includes('adicional');
  };
  const headerIndex = rows.findIndex(row => row.some(isDriverHeader) && row.some(isExtraHeader));
  if (headerIndex < 0) return [];
  const header = rows[headerIndex].map(normalizeHeader);
  const nameColumn = header.findIndex(value => isDriverHeader(value));
  const extraColumn = header.findIndex(value => isExtraHeader(value));
  const scheduleStarts = header.map((value, index) => /^(horario|hora|entrada|saida|batida|jornada|turno)/.test(value) ? index : -1).filter(index => index >= 0 && index !== extraColumn);
  const scheduleColumns = [...new Set(scheduleStarts.flatMap(index => [index, index + 1]))].filter(index => index < header.length && index !== extraColumn);
  return rows.slice(headerIndex + 1).map(row => ({ motorista: String(row[nameColumn] || '').trim(), extraNormalPadrao: parseDurationMinutes(row[extraColumn]), horarios: scheduleColumns.map(index => formatTimeValue(row[index])).filter(value => /\d{1,2}:\d{2}/.test(value)) })).filter(row => row.motorista);
}

function dateKeyFromValue(value) {
  const text = String(value ?? '');
  const iso = text.match(/(20\d{2})[-\/](\d{2})[-\/](\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = text.match(/(\d{2})[-\/](\d{2})[-\/](20\d{2})/);
  return br ? `${br[3]}-${br[2]}-${br[1]}` : '';
}

export function extractScaleRows(rows = [], reportDate = '') {
  if (!rows.length) return [];
  const headerIndex = rows.findIndex(row => {
    const values = row.map(normalizeHeader);
    return values.some(value => aliases.motorista.includes(value)) && values.some(value => value.includes('horario') || value.includes('linha'));
  });
  const start = headerIndex >= 0 ? headerIndex + 1 : 1;
  const header = headerIndex >= 0 ? rows[headerIndex].map(normalizeHeader) : [];
  const find = (...names) => names.map(name => header.findIndex(value => value === normalizeHeader(name))).find(index => index >= 0) ?? -1;
  const nameColumn = find('motorista', 'nome', 'colaborador');
  const dateColumn = header.findIndex(value => value === 'data' || value === 'dia' || value.includes('data'));
  const timeColumn = header.findIndex(value => value.includes('horario') || value.includes('hora') || value === 'inicio');
  const lineColumn = header.findIndex(value => value.includes('linha') || value.includes('servico') || value.includes('cliente') || value.includes('descricao'));
  return rows.slice(start).map(row => {
    const motorista = String(row[nameColumn >= 0 ? nameColumn : 0] || '').trim();
    const dataKey = dateKeyFromValue(row[dateColumn]);
    return {
      motorista,
      nome: motorista,
      dataKey,
      horario: String(row[timeColumn >= 0 ? timeColumn : 1] || '').trim(),
      linha: String(row[lineColumn >= 0 ? lineColumn : 2] || '').trim(),
      dados: row
    };
  }).filter(row => row.motorista && (!reportDate || !row.dataKey || row.dataKey === reportDate));
}
