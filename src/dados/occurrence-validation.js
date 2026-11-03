const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const TYPES = new Set(['Falta', 'Atestado', 'Horas faltantes']);

export function validateOccurrence(event = {}) {
  const errors = [];
  const motorista = String(event.motorista || '').trim();
  const minutos = Number(event.minutos);
  if (!DATE_KEY.test(String(event.dataKey || ''))) errors.push('Informe uma data válida.');
  if (!motorista) errors.push('Informe o motorista.');
  else if (motorista.length > 120) errors.push('O nome do motorista deve ter no máximo 120 caracteres.');
  if (!TYPES.has(event.tipo)) errors.push('Selecione um tipo de ocorrência válido.');
  if (!Number.isInteger(minutos) || minutos < 0 || minutos > 1440) errors.push('Os minutos devem ser um número inteiro entre 0 e 1440.');
  if (String(event.observacao || '').length > 500) errors.push('A observação deve ter no máximo 500 caracteres.');
  return { valid: errors.length === 0, errors };
}
