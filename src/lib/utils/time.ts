// ============================================================
// Time Utilities
// ============================================================

/**
 * Converte serial de fração de dia do Excel para minutos.
 * Excel armazena horários como fração de 24h (ex: 0.5 = 12:00 = 720min).
 * Funciona para seriais do sistema 1900 e 1904.
 */
export function excelSerialToMinutes(serial: number): number {
  return Math.round(serial * 1440);
}

/**
 * Converte minutos totais para string "HH:MM".
 */
export function minutesToHHMM(totalMin: number): string {
  const negative = totalMin < 0;
  const abs = Math.abs(Math.round(totalMin));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const hStr = String(h).padStart(2, '0');
  const mStr = String(m).padStart(2, '0');
  return negative ? `-${hStr}:${mStr}` : `${hStr}:${mStr}`;
}

/**
 * Converte string "HH:MM" para minutos totais.
 */
export function hhmmToMinutes(hhmm: string): number {
  if (!hhmm) return 0;
  const negative = hhmm.startsWith('-');
  const clean = hhmm.replace('-', '');
  const parts = clean.split(':');
  if (parts.length < 2) return 0;
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  const total = h * 60 + m;
  return negative ? -total : total;
}

/**
 * Parseia uma string de batidas de ponto separadas por espaço.
 * Ex: "17:16 18:56 20:17 23:33 02:50"
 * Retorna array de Date com virada de turno ajustada.
 */
export function parseBatidas(raw: string, baseDate: Date): Date[] {
  if (!raw || !raw.trim()) return [];

  const tokens = raw.trim().split(/\s+/);
  const dates: Date[] = [];
  let dayOffset = 0;

  for (let i = 0; i < tokens.length; i++) {
    const parts = tokens[i].split(':');
    if (parts.length < 2) continue;

    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) continue;

    // Virada de turno: se a batida for menor que a anterior, soma 1 dia
    if (i > 0) {
      const prev = dates[dates.length - 1];
      const prevTotalMin = prev.getHours() * 60 + prev.getMinutes();
      const currTotalMin = h * 60 + m;
      if (currTotalMin < prevTotalMin) {
        dayOffset += 1;
      }
    }

    const dt = new Date(baseDate);
    dt.setDate(dt.getDate() + dayOffset);
    dt.setHours(h, m, 0, 0);
    dates.push(dt);
  }

  return dates;
}

/**
 * Calcula diferença em minutos entre dois Date (absoluta).
 */
export function diffMinutes(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / 60000;
}

/**
 * Formata data no padrão brasileiro DD/MM/AAAA.
 */
export function formatDateBR(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

/**
 * Converte string DD/MM/AAAA para YYYY-MM-DD.
 */
export function brDateToISO(brDate: string): string {
  const parts = brDate.split('/');
  if (parts.length < 3) return brDate;
  return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
}

/**
 * Converte string YYYY-MM-DD para Date (meia-noite local).
 */
export function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
