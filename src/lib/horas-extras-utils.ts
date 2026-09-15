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
