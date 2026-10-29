const aliases = {
  motorista: ['motorista', 'nome', 'colaborador', 'funcionario'],
  matricula: ['matricula', 'matrícula', 'codigo', 'código'],
  he1min: ['he1', 'he 1', 'hora extra 1', 'extra 1'],
  he2min: ['he2', 'he 2', 'hora extra 2', 'extra 2'],
  he3min: ['he3', 'he 3', 'hora extra 3', 'extra 3'],
};

function normalizeHeader(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function parseMinutes(value) {
  if (typeof value === 'number') return Math.round(value * 24 * 60);
  const text = String(value || '').trim();
  if (!text) return 0;
  const match = text.match(/^(\d+):([0-5]\d)$/);
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
    he1min: parseMinutes(row[columns.he1min]),
    he2min: parseMinutes(row[columns.he2min]),
    he3min: parseMinutes(row[columns.he3min]),
  })).filter(row => row.motorista);
}
