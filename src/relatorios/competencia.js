function parseDateKey(dateKey) {
  const [year, month, day] = String(dateKey).split('-').map(Number);
  if (!year || !month || !day) throw new Error(`Data inválida: ${dateKey}`);
  return new Date(Date.UTC(year, month - 1, day));
}

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function label(dateKeyValue) {
  const [year, month, day] = dateKeyValue.split('-');
  return `${day}/${month}/${year}`;
}

export function competenciaParaData(dateKeyValue) {
  const date = parseDateKey(dateKeyValue);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const startYear = date.getUTCDate() >= 28 ? year : (month === 0 ? year - 1 : year);
  const startMonth = date.getUTCDate() >= 28 ? month : (month === 0 ? 11 : month - 1);
  const endYear = date.getUTCDate() >= 28 ? (month === 11 ? year + 1 : year) : year;
  const endMonth = date.getUTCDate() >= 28 ? (month + 1) % 12 : month;
  const inicio = dateKey(new Date(Date.UTC(startYear, startMonth, 28)));
  const fim = dateKey(new Date(Date.UTC(endYear, endMonth, 27)));
  return { inicio, fim, chave: `${inicio}_${fim}`, rotulo: `${label(inicio)} a ${label(fim)}` };
}

export function listarDatas(inicio, fim) {
  const current = parseDateKey(inicio);
  const end = parseDateKey(fim);
  const dates = [];
  while (current <= end) {
    dates.push(dateKey(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}
