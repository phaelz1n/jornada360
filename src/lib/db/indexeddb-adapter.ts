// ============================================================
// IndexedDB Adapter Implementation (Offline Mode)
// ============================================================

import { openDB, type IDBPDatabase } from 'idb';
import type { IDataAdapter } from './adapter';
import type { Workspace } from '@/types/workspace';
import type { AuditItem, AuditLogEntry } from '@/types/audit';
import type { Pendencia, PendenciaFilters } from '@/types/pendencia';
import type { TransferPackage, DateRange } from '@/types/transfer';
import { createDefaultConfig } from '@/types/workspace';

const DB_NAME = 'jornada360';
const DB_VERSION = 1;

interface J360DB {
  workspaces: { key: string; value: Workspace };
  snapshots: { key: string; value: { workspaceId: string; dateKey: string; items: AuditItem[] } };
  pendencias: { key: string; value: Pendencia; indexes: { byWorkspace: string } };
  auditLog: { key: string; value: AuditLogEntry; indexes: { byWorkspace: string } };
}

async function getDB(): Promise<IDBPDatabase<J360DB>> {
  return openDB<J360DB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Workspaces
      if (!db.objectStoreNames.contains('workspaces')) {
        db.createObjectStore('workspaces', { keyPath: 'id' });
      }

      // Snapshots (key = workspaceId_dateKey)
      if (!db.objectStoreNames.contains('snapshots')) {
        db.createObjectStore('snapshots');
      }

      // Pendências
      if (!db.objectStoreNames.contains('pendencias')) {
        const store = db.createObjectStore('pendencias', { keyPath: 'id' });
        store.createIndex('byWorkspace', 'workspaceId');
      }

      // Log de auditoria
      if (!db.objectStoreNames.contains('auditLog')) {
        const store = db.createObjectStore('auditLog', { keyPath: 'id' });
        store.createIndex('byWorkspace', 'workspaceId');
      }
    },
  });
}

export class IndexedDBAdapter implements IDataAdapter {
  // --- Workspace ---

  async getWorkspace(id: string): Promise<Workspace | null> {
    const db = await getDB();
    const ws = await db.get('workspaces', id);
    return ws || null;
  }

  async saveWorkspace(ws: Workspace): Promise<void> {
    const db = await getDB();
    await db.put('workspaces', { ...ws, updatedAt: new Date() });
  }

  // --- Snapshots ---

  async getSnapshot(workspaceId: string, dateKey: string): Promise<AuditItem[]> {
    const db = await getDB();
    const key = `${workspaceId}_${dateKey}`;
    const snap = await db.get('snapshots', key);
    return snap?.items || [];
  }

  async saveSnapshot(workspaceId: string, dateKey: string, items: AuditItem[]): Promise<void> {
    const db = await getDB();
    const key = `${workspaceId}_${dateKey}`;
    await db.put('snapshots', { workspaceId, dateKey, items }, key);
  }

  async getSnapshotDates(workspaceId: string): Promise<string[]> {
    const db = await getDB();
    const allKeys = await db.getAllKeys('snapshots');
    const prefix = `${workspaceId}_`;
    return allKeys
      .filter(k => typeof k === 'string' && k.startsWith(prefix))
      .map(k => (k as string).substring(prefix.length))
      .sort()
      .reverse();
  }

  // --- Pendências ---

  async getPendencias(workspaceId: string, filters?: PendenciaFilters): Promise<Pendencia[]> {
    const db = await getDB();
    const tx = db.transaction('pendencias', 'readonly');
    const idx = tx.store.index('byWorkspace');
    let results = await idx.getAll(workspaceId);

    if (filters?.status && filters.status.length > 0) {
      results = results.filter(p => filters.status!.includes(p.status));
    }
    if (filters?.prioridade && filters.prioridade.length > 0) {
      results = results.filter(p => filters.prioridade!.includes(p.prioridade));
    }
    if (filters?.tipo && filters.tipo.length > 0) {
      results = results.filter(p => filters.tipo!.includes(p.tipo));
    }
    if (filters?.motorista) {
      results = results.filter(p =>
        p.motorista.toUpperCase().includes(filters.motorista!.toUpperCase())
      );
    }
    if (filters?.dataInicio) {
      results = results.filter(p => p.data >= filters.dataInicio!);
    }
    if (filters?.dataFim) {
      results = results.filter(p => p.data <= filters.dataFim!);
    }

    return results;
  }

  async savePendencia(p: Pendencia): Promise<void> {
    const db = await getDB();
    await db.put('pendencias', { ...p, updatedAt: new Date() });
  }

  async updatePendencia(id: string, changes: Partial<Pendencia>): Promise<void> {
    const db = await getDB();
    const existing = await db.get('pendencias', id);
    if (existing) {
      await db.put('pendencias', { ...existing, ...changes, updatedAt: new Date() });
    }
  }

  async deletePendencia(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('pendencias', id);
  }

  // --- Log de Auditoria ---

  async logAuditChange(entry: AuditLogEntry): Promise<void> {
    const db = await getDB();
    await db.put('auditLog', entry);
  }

  async getAuditLog(workspaceId: string, auditItemId?: string): Promise<AuditLogEntry[]> {
    const db = await getDB();
    const tx = db.transaction('auditLog', 'readonly');
    const idx = tx.store.index('byWorkspace');
    let results = await idx.getAll(workspaceId);

    if (auditItemId) {
      results = results.filter(e => e.auditItemId === auditItemId);
    }

    return results.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  // --- Transfer ---

  async exportPackage(workspaceId: string, periodo: DateRange): Promise<TransferPackage> {
    const ws = await this.getWorkspace(workspaceId);
    const config = ws?.config || createDefaultConfig();

    const allDates = await this.getSnapshotDates(workspaceId);
    const filteredDates = allDates.filter(d => d >= periodo.inicio && d <= periodo.fim);

    const auditItems: AuditItem[] = [];
    for (const date of filteredDates) {
      const items = await this.getSnapshot(workspaceId, date);
      auditItems.push(...items);
    }

    const pendencias = await this.getPendencias(workspaceId, {
      dataInicio: periodo.inicio,
      dataFim: periodo.fim,
    });

    return {
      version: '1.0',
      workspaceId,
      exportedAt: new Date(),
      periodo,
      auditItems,
      pendencias,
      config,
    };
  }

  async importPackage(pkg: TransferPackage): Promise<void> {
    const byDate = new Map<string, AuditItem[]>();
    for (const item of pkg.auditItems) {
      const existing = byDate.get(item.data) || [];
      existing.push(item);
      byDate.set(item.data, existing);
    }

    for (const [dateKey, items] of byDate) {
      await this.saveSnapshot(pkg.workspaceId, dateKey, items);
    }

    for (const p of pkg.pendencias) {
      await this.savePendencia(p);
    }
  }
}
