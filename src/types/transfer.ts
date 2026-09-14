// ============================================================
// Transfer Package (jornada360-transferencia)
// ============================================================

import type { AuditItem } from './audit';
import type { Pendencia } from './pendencia';
import type { WorkspaceConfig } from './workspace';

export interface TransferPackage {
  /** Versão do formato do pacote */
  version: string;
  workspaceId: string;
  exportedAt: Date;
  periodo: DateRange;
  auditItems: AuditItem[];
  pendencias: Pendencia[];
  config: WorkspaceConfig;
}

export interface DateRange {
  /** Data de início (YYYY-MM-DD) */
  inicio: string;
  /** Data de fim (YYYY-MM-DD) */
  fim: string;
}
