/*
 * Funções puras portadas fielmente de public/motor-he/index.html (Assistente de HE diário).
 * Não reimplementa o parsing de planilhas (xlsx/rastreio/escala/padrão) — isso continua rodando,
 * intacto, dentro do iframe. Aqui só reproduzimos a lógica determinística de pós-processamento
 * (heEfetivo/reclassificar/etc.) para poder ler e reclassificar o que o motor já calculou e salvou.
 */

export type ItemStatus = 'forte' | 'leve' | 'ok' | 'sem_dado';
export type PadraoStatus = 'acima' | 'dentro' | 'sem_cadastro' | 'invalido';

export interface HEItemRaw {
  motorista: string;
  he1min: number;
  he1str: string;
  status: ItemStatus;
  rastreioStatus: ItemStatus;
  detalhe: string;
  confirmadas: string;
  batidas: string;
  contexto: string;
  padraoStatus: PadraoStatus;
  padraoMin: number | null;
  excedenteMin: number;
  padraoDebug: string;
  padraoHorarios: string[];
  setorAtual: string;
  causaAtual: string | null;
  causaFonte: 'historico' | 'heuristica' | null;
  /** Texto do motor quando o descanso entre jornadas ficou abaixo do mínimo configurado no
   *  workspace (`rules.interjourneyMinHours`). Vazio = dentro do mínimo ou sem dado do dia anterior. */
  interjornada: string;
  /** Idem para a pausa intrajornada vs `rules.intervalMinMin`. Vazio = dentro do mínimo, ou o
   *  espelho não registrou pausa (menos de 4 batidas) — nesse caso nada é concluído.
   *  Opcional porque snapshots gravados antes desta versão do motor não têm o campo. */
  intervalo?: string;
  diaAjustado: number;
  temLacuna: boolean;
  precisaVerificar: boolean;
}

export interface HEDiaSnapshot {
  dateKey: string;
  dateLabel: string;
  items: HEItemRaw[];
  totalHE: number;
  acimaHE: number;
  programadoHE: number;
  semPadraoCount: number;
  avisoPadrao: string;
}

export interface HECaseState {
  done?: boolean;
  setor?: string;
  causa?: string;
  justificativa?: string;
  heCorrigida?: number;
}

const DIACRITIC_MARKS = /[̀-ͯ]/g;

export function normName(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .toString()
    .toUpperCase()
    .trim()
    .normalize('NFD')
    .replace(DIACRITIC_MARKS, '')
    .replace(/\s+/g, ' ');
}

export function minToStr(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return String(h).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}

export function minToStrSigned(m: number): string {
  return m < 0 ? '-' + minToStr(-m) : minToStr(m);
}

/* HE corrigida manualmente sempre tem prioridade sobre o HE.1 original lido do espelho. */
export function heEfetivo(it: HEItemRaw, c?: HECaseState): number {
  const cor = c?.heCorrigida;
  return cor !== undefined && cor !== null && !Number.isNaN(cor) ? cor : it.he1min;
}

/* Recalcula status/padrão/excedente com base no HE efetivo (original ou corrigido) e na
 * tolerância CONFIGURADA do workspace ativo (nunca um valor fixo) — ver services/toleranceService.ts,
 * que é quem toda a interface deveria chamar em vez de importar esta função diretamente. */
export function reclassificar(
  it: HEItemRaw,
  heMin: number,
  toleranceMin: number,
): { status: ItemStatus; padraoStatus: PadraoStatus; excedenteMin: number } {
  if (it.padraoMin === null || it.padraoMin === undefined) {
    return { status: it.status, padraoStatus: it.padraoStatus, excedenteMin: it.excedenteMin };
  }
  const excedenteMin = heMin - it.padraoMin;
  const padraoStatus: PadraoStatus = excedenteMin > toleranceMin ? 'acima' : 'dentro';
  const status: ItemStatus = padraoStatus === 'dentro' ? 'ok' : it.rastreioStatus || it.status;
  return { status, padraoStatus, excedenteMin };
}

export function resolvedSetor(it: HEItemRaw, c?: HECaseState): string {
  const trimmed = c?.setor ? c.setor.trim() : '';
  return trimmed || it.setorAtual || 'Sem setor definido';
}

export function itemKey(it: HEItemRaw): string {
  return normName(it.motorista);
}

export function dkToLabel(dk: string): string {
  const [y, m, d] = dk.split('-');
  return `${d}/${m}/${y}`;
}

export function statusLabel(s: ItemStatus): string {
  return { forte: 'Diverge forte', leve: 'Diverge leve', ok: 'Confirmado', sem_dado: 'Sem dado' }[s] ?? s;
}

export function mesLabel(mk: string): string {
  const [y, m] = mk.split('-');
  const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${nomes[parseInt(m, 10) - 1]}/${y}`;
}

/* Ciclo de fechamento do ponto: sempre do dia 28 de um mês até o dia 27 do mês seguinte. */
export function cicloKeyFor(dk: string): string {
  const [y, m, d] = dk.split('-').map(Number);
  if (d >= 28) return `${y}-${String(m).padStart(2, '0')}-28`;
  const prevM = m === 1 ? 12 : m - 1;
  const prevY = m === 1 ? y - 1 : y;
  return `${prevY}-${String(prevM).padStart(2, '0')}-28`;
}

export function cicloLabel(cicloKey: string): string {
  const [y, m] = cicloKey.split('-').map(Number);
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  return `28/${String(m).padStart(2, '0')} a 27/${String(nextM).padStart(2, '0')}/${nextY}`;
}
