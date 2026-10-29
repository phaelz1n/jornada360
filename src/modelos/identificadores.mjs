function normalizarTexto(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function stableDriverId({ nome = '', matricula = '' } = {}) {
  const matriculaId = normalizarTexto(matricula);
  return matriculaId || normalizarTexto(nome);
}

