// ============================================================
// Schedule Types (Horário Padrão & Escala)
// ============================================================

export interface ScheduleSlot {
  /** Horário de entrada (HH:MM) */
  entrada: string;
  /** Horário de saída (HH:MM) */
  saida: string;
  /** Duração do slot em minutos */
  duracaoMin: number;
}

export interface StandardSchedule {
  /** Nome do colaborador */
  nome: string;
  /** Nome normalizado */
  nomeNormalizado: string;
  /** Slots de horário (Horário 1, 2, 3) */
  horarios: ScheduleSlot[];
  /** TOTAL em minutos (serial Excel * 1440) */
  totalMin: number;
  /** CARGA H em minutos */
  cargaHMin: number;
  /**
   * EXTRA em minutos (pode ser negativo se TOTAL < CARGA H).
   * Quando negativo, indica inconsistência cadastral.
   */
  extraPadraoMin: number;
  /** true se extraPadraoMin < 0 */
  isInconsistente: boolean;
}

export interface ScaleEntry {
  /** Nome do motorista base */
  motorista: string;
  /** Nome normalizado */
  motoristaNormalizado: string;
  /** Data da escala (YYYY-MM-DD) */
  data: string;
  /** Descrição do horário escalado */
  horario: string;
  /** Descrição da rota/serviço */
  descricao: string;
  /** Nome do substituto, se houver */
  substituicao?: string;
}
