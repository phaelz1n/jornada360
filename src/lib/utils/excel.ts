// ============================================================
// Excel / SheetJS Helpers
// ============================================================

import * as XLSX from 'xlsx';
import { excelSerialToMinutes, minutesToHHMM } from './time';

/**
 * Lê um workbook a partir de um ArrayBuffer.
 */
export function readWorkbook(buffer: ArrayBuffer): XLSX.WorkBook {
  return XLSX.read(buffer, { type: 'array', cellDates: true, raw: false });
}

/**
 * Obtém os dados de uma planilha como matriz 2D de strings/valores.
 */
export function sheetToMatrix(worksheet: XLSX.WorkSheet): any[][] {
  return XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
}

/**
 * Localiza a linha de cabeçalho em uma matriz buscando por palavras-chave esperadas.
 * Retorna o índice da linha (0-indexed) ou -1 se não encontrado.
 */
export function findHeaderRow(rows: any[][], keywords: string[], maxScanRows = 20): number {
  for (let i = 0; i < Math.min(rows.length, maxScanRows); i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;
    const rowText = row.map(c => String(c ?? '').toLowerCase()).join(' ');
    const matchCount = keywords.filter(kw => rowText.includes(kw.toLowerCase())).length;
    if (matchCount >= Math.min(2, keywords.length)) {
      return i;
    }
  }
  return -1;
}

/**
 * Extrai valor de tempo de uma célula que pode ser número serial, Date ou string HH:MM.
 * Retorna os minutos totais (ex: 8:00 -> 480).
 */
export function parseCellToMinutes(val: any): number {
  if (val === null || val === undefined || val === '') return 0;

  if (typeof val === 'number') {
    // Se for fração de dia (< 1), multiplica por 1440
    if (val >= 0 && val <= 1) {
      return excelSerialToMinutes(val);
    }
    // Se for número maior que 1 mas formato de hora inteiro (ex: 800 para 8h), ou serial maior
    if (val > 1 && val < 24) {
      return Math.round(val * 60);
    }
    return Math.round(val);
  }

  if (val instanceof Date) {
    return val.getHours() * 60 + val.getMinutes();
  }

  const str = String(val).trim();
  if (!str) return 0;

  // Formato "-HH:MM" ou "HH:MM"
  const isNegative = str.startsWith('-');
  const clean = str.replace('-', '').trim();
  const match = clean.match(/^(\d{1,2}):(\d{2})/);
  if (match) {
    const h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const tot = h * 60 + m;
    return isNegative ? -tot : tot;
  }

  // Tenta parse float
  const num = parseFloat(str.replace(',', '.'));
  if (!isNaN(num)) {
    if (num >= 0 && num <= 1) return excelSerialToMinutes(num);
    return Math.round(num * 60);
  }

  return 0;
}

/**
 * Normaliza uma data para o formato YYYY-MM-DD a partir de Date, string DD/MM/AAAA ou serial.
 */
export function parseCellToDateISO(val: any): string {
  if (!val) return '';

  if (val instanceof Date && !isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const str = String(val).trim();
  // Formato DD/MM/YYYY ou DD/MM/AA
  const brMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (brMatch) {
    const d = brMatch[1].padStart(2, '0');
    const m = brMatch[2].padStart(2, '0');
    let y = brMatch[3];
    if (y.length === 2) y = '20' + y;
    return `${y}-${m}-${d}`;
  }

  // Formato YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  return '';
}

/**
 * Cria e dispara download de um arquivo Excel (.xlsx) com múltiplas abas.
 */
export function downloadWorkbook(sheets: { name: string; data: any[][] }[], filename: string) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.data);
    XLSX.utils.book_append_sheet(wb, ws, s.name.substring(0, 31));
  }
  XLSX.writeFile(wb, filename);
}
