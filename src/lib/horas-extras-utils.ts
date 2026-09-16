// ============================================================
// Tipos e Utilitários Compartilhados de Horas Extras (Client & Server)
// ============================================================

export interface HoraExtraItem {
  id: string;
  tipo: 'HE1' | 'HE2' | 'HE3';
  colaborador: string;
  data: string; // DD/MM/YYYY
  pontoRegistrado: string;
  horasExtrasDecimal: number;
  horasExtrasFormatada: string; // HH:mm
  minutosTotais: number;
  setorMotivo?: string;
  responsavelOriginal?: string;
  justificativaOriginal?: string;
  // Campos da Planilha Oficial de Ciclo
  horarioPadrao?: string;
  hePrevistaFormatada?: string;
  hePrevistaMin?: number;
  acimaPadraoFormatada?: string;
  acimaPadraoMin?: number;
  situacao?: string; // 'Acima do padrão' | 'Dentro do padrão' | 'Sem referência'
  causa?: string;
  conferido?: string; // 'sim' | 'não'
  observacao?: string;
  // Campos dinâmicos / Auditados
  justificativa: string;
  temJustificativa: boolean;
  dentroDoPadrao: boolean;
  possivelProblema: boolean;
  problemaDescricao: string;
  alteradoPor?: string;
  alteradoPorUid?: string;
  alteradoEm?: string;
  historicoAlteracoes?: Array<{
    justificativa: string;
    alteradoPor: string;
    alteradoEm: string;
  }>;
}

export interface HorasExtrasSummary {
  totalRegistros: number;
  totalHE1: number;
  totalHE2: number;
  totalHE3: number;
  pendentesJustificativa: number;
  dentroDoPadrao: number;
  justificadas: number;
  minutosTotaisGeral: number;
  horasTotaisFormatada: string;
  totalAcimaPadraoMinutos?: number;
  totalAcimaPadraoFormatada?: string;
  conferidosCount?: number;
  pendentesConferenciaCount?: number;
}

/**
 * Verifica se o registro de hora extra está dentro do padrão (programado),
 * dispensando a necessidade de justificativa manual.
 */
export function isDentroDoPadrao(setor?: string, just?: string): boolean {
  const s = (setor || '').toLowerCase().trim();
  const j = (just || '').toLowerCase().trim();
  return (
    s.includes('dentro do padr') ||
    s.includes('dentro do padrao') ||
    j.includes('dentro do padr') ||
    j.includes('dentro do padrao') ||
    s.includes('programad') ||
    j.includes('programad')
  );
}

/**
 * Converte fração decimal de dia do Excel (ex: 0.0243 = 35min) em HH:mm e minutos totais
 */
export function excelFractionToTime(val: unknown): { formatado: string; minutos: number } {
  if (val === null || val === undefined) return { formatado: '00:00', minutos: 0 };

  let num = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
  if (isNaN(num)) return { formatado: '00:00', minutos: 0 };

  let totalMinutos = 0;
  if (num < 1) {
    totalMinutos = Math.round(num * 24 * 60);
  } else {
    totalMinutos = Math.round(num * 60);
  }

  const h = Math.floor(totalMinutos / 60);
  const m = totalMinutos % 60;
  const formatado = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return { formatado, minutos: totalMinutos };
}
