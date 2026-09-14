// ============================================================
// Audit / Conciliation Types
// ============================================================

import type { ClockEvent } from './point';
import type { VehicleEvent } from './tracking';
import type { StandardSchedule, ScaleEntry } from './schedule';
import type { PointRecord } from './point';
import type { TrackingRecord } from './tracking';

// --- Enums de classificação ---

export type ConciliationStatus =
  | 'confirmado'             // ≤ tolerância (10–15 min)
  | 'divergencia_leve'       // 16–60 min
  | 'divergencia_forte'      // > 60 min
  | 'sem_cobertura';         // fora da janela de sinal

export type ExcedenteClassificacao =
  | 'dentro_padrao'          // excedente ≤ 10 min
  | 'acima_padrao'           // excedente > 10 min
  | 'sem_referencia'         // sem horário padrão cadastrado
  | 'cadastro_inconsistente'; // padrão com EXTRA negativo

// --- Resultado de batida conciliada ---

export interface BatidaConciliada {
  batida: ClockEvent;
  /** Evento de rastreio mais próximo (pode não existir) */
  eventoRastreio?: VehicleEvent;
  /** Diferença em minutos entre batida e evento */
  diferencaMin: number;
  /** Status da conciliação */
  status: ConciliationStatus;
}

// --- Item principal de auditoria ---

export interface AuditItem {
  id: string;
  workspaceId: string;
  /** Data auditada (YYYY-MM-DD) */
  data: string;
  motorista: string;
  motoristaNormalizado: string;
  cpf?: string;
  matricula?: string;

  // --- Dados brutos vinculados ---
  ponto?: PointRecord;
  rastreio?: TrackingRecord;
  horarioPadrao?: StandardSchedule;
  escala?: ScaleEntry;

  // --- Resultado da conciliação ---
  batidasConciliadas: BatidaConciliada[];
  /** Ajuste de dia: -1, 0 ou +1 para melhor match de turno noturno */
  bestDayShift: -1 | 0 | 1;

  // --- Cálculos de HE ---
  /** HE efetiva registrada no espelho (minutos) */
  heEfetivaMin: number;
  /** HE prevista pelo padrão homologado (minutos) */
  hePrevistaMin: number;
  /** Excedente = min(efetiva - prevista, efetiva), nunca negativo */
  excedenteMin: number;
  /** Classificação do excedente */
  excedenteClassificacao: ExcedenteClassificacao;

  // --- Interjornada ---
  /** Intervalo em minutos da última saída de ontem até 1ª entrada hoje */
  interjornadaMin?: number;
  /** Déficit de interjornada em minutos (quanto faltou para 11h) */
  interjornadaDeficit?: number;

  // --- Resolução ---
  resolvido: boolean;
  setor?: string;
  causaProvavel?: string;
  /** Causa sugerida pelo motor heurístico */
  causaSugerida?: string;
  justificativa?: string;
  /** HE corrigida manualmente (minutos) */
  heCorrigidaMin?: number;

  // --- Metadados ---
  createdAt: Date;
  updatedAt: Date;
}

// --- Log de auditoria imutável ---

export interface AuditLogEntry {
  id: string;
  workspaceId: string;
  auditItemId: string;
  campo: string;
  valorAnterior: string;
  valorNovo: string;
  usuario: string;
  timestamp: Date;
  motivo?: string;
}
