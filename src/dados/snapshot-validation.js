const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function validateSnapshot(snapshot = {}) {
  const errors = [];
  if (!DATE_KEY.test(String(snapshot.dateKey || ''))) errors.push('dateKey deve estar no formato YYYY-MM-DD');
  if (!Array.isArray(snapshot.items)) errors.push('items deve ser uma lista');
  return { valid: errors.length === 0, errors };
}
