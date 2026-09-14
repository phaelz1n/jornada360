// ============================================================
// Point / Clock Record Types (Espelho de Ponto)
// ============================================================

export type ClockEventType = 'entrada' | 'saida' | 'indefinido';

export interface ClockEvent {
  /** Datetime da batida (com virada de turno ajustada) */
  time: Date;
  /** Tipo inferido pela posição par/ímpar */
  type: ClockEventType;
  /** String original do Excel (ex: "17:16") */
  rawString: string;
}

export interface PointRecord {
  id: string;
  /** Nome do colaborador como veio do Excel */
  nome: string;
  /** Nome normalizado (uppercase, sem acentos, sem duplo espaço) */
  nomeNormalizado: string;
  cpf?: string;
  matricula?: string;
  /** Data no formato YYYY-MM-DD */
  data: string;
  /** Batidas parseadas e ordenadas */
  batidas: ClockEvent[];
  /** Horas normais em minutos */
  hnMin: number;
  /** Hora extra faixa 1 em minutos */
  he1Min: number;
  /** Hora extra faixa 2 em minutos */
  he2Min: number;
  /** String original de batidas do Excel (ex: "17:16 18:56 20:17 23:33 02:50") */
  rawBatidas: string;
}
