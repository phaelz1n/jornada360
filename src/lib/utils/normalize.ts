// ============================================================
// Name Normalization Utilities
// ============================================================

/**
 * Remove acentos/diacríticos de uma string.
 */
export function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Normaliza um nome para comparação:
 * - trim
 * - uppercase
 * - remove acentos
 * - remove caracteres especiais (mantém letras, números e espaços)
 * - colapsa espaços duplos
 */
export function normalizeName(name: string): string {
  if (!name) return '';
  return removeAccents(name)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Normaliza CPF removendo pontos e traço.
 */
export function normalizeCPF(cpf: string): string {
  return cpf.replace(/[.\-]/g, '').trim();
}

/**
 * Normaliza matrícula removendo zeros à esquerda e espaços.
 */
export function normalizeMatricula(matricula: string): string {
  return matricula.trim().replace(/^0+/, '') || '0';
}
