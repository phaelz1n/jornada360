// ============================================================
// Tipos de Integração Contínua via APIs (Cobli & Icarus)
// ============================================================

import type { AuditItem } from './audit';
import type { Pendencia } from './pendencia';

/**
 * Evento de rastreamento normalizado da Cobli
 */
export interface TrackingEvent {
  id: string;
  driverName: string;
  driverDoc?: string;
  vehiclePlate: string;
  departureTime: string; // ISO
  stopTime: string;      // ISO
  durationMin: number;
  distanceKm: number;
  isTelematicsGap: boolean;
}

/**
 * Registro de ponto normalizado do Icarus
 */
export interface PointRecordNormalized {
  employeeId: string;
  name: string;
  cpf: string;
  registration: string;
  date: string; // YYYY-MM-DD
  punches: Array<{ time: string; originalTimestamp: string }>;
  he1Min: number;
  he2Min: number;
  hnMin: number;
}

/**
 * Registro de auditoria/log da sincronização (sync_logs)
 */
export interface SyncLogEntry {
  id: string;
  workspaceId: string;
  timestamp: string; // ISO
  trigger: 'manual' | 'cron';
  status: 'sucesso' | 'parcial' | 'erro';
  periodo: {
    inicio: string; // YYYY-MM-DD
    fim: string;    // YYYY-MM-DD
  };
  metricas: {
    pontosRecebidos: number;
    trajetosRecebidos: number;
    motoristasAuditados: number;
    pendenciasGeradas: number;
    duracaoMs: number;
  };
  erros?: string[];
  detalhes?: {
    icarusStatus: 'ok' | 'falha' | 'desativado';
    cobliStatus: 'ok' | 'falha' | 'desativado';
  };
}

export interface SyncOptions {
  workspaceId: string;
  startDate?: string;
  endDate?: string;
  trigger?: 'manual' | 'cron';
}

export interface SyncResult {
  success: boolean;
  log: SyncLogEntry;
  auditItems?: AuditItem[];
  pendencias?: Pendencia[];
}
