// ============================================================
// Data Adapter Interface
// ============================================================

import type { Workspace } from '@/types/workspace';
import type { AuditItem, AuditLogEntry } from '@/types/audit';
import type { Pendencia, PendenciaFilters } from '@/types/pendencia';
import type { TransferPackage, DateRange } from '@/types/transfer';

/**
 * Interface abstrata para persistência de dados.
 * Duas implementações: FirestoreAdapter e IndexedDBAdapter.
 */
export interface IDataAdapter {
  // --- Workspace ---
  getWorkspace(id: string): Promise<Workspace | null>;
  saveWorkspace(ws: Workspace): Promise<void>;

  // --- Snapshots diários (registros auditados) ---
  getSnapshot(workspaceId: string, dateKey: string): Promise<AuditItem[]>;
  saveSnapshot(workspaceId: string, dateKey: string, items: AuditItem[]): Promise<void>;
  getSnapshotDates(workspaceId: string): Promise<string[]>;

  // --- Pendências ---
  getPendencias(workspaceId: string, filters?: PendenciaFilters): Promise<Pendencia[]>;
  savePendencia(p: Pendencia): Promise<void>;
  updatePendencia(id: string, changes: Partial<Pendencia>): Promise<void>;
  deletePendencia(id: string): Promise<void>;

  // --- Log de auditoria (imutável) ---
  logAuditChange(entry: AuditLogEntry): Promise<void>;
  getAuditLog(workspaceId: string, auditItemId?: string): Promise<AuditLogEntry[]>;

  // --- Transfer ---
  exportPackage(workspaceId: string, periodo: DateRange): Promise<TransferPackage>;
  importPackage(pkg: TransferPackage): Promise<void>;
}
