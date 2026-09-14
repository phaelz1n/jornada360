// ============================================================
// Firestore Adapter Implementation
// ============================================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  addDoc,
} from 'firebase/firestore';
import { getFirestore } from '@/lib/firebase';
import type { IDataAdapter } from './adapter';
import type { Workspace } from '@/types/workspace';
import type { AuditItem, AuditLogEntry } from '@/types/audit';
import type { Pendencia, PendenciaFilters } from '@/types/pendencia';
import type { TransferPackage, DateRange } from '@/types/transfer';
import { createDefaultConfig } from '@/types/workspace';

export class FirestoreAdapter implements IDataAdapter {
  private get db() {
    return getFirestore();
  }

  // --- Workspace ---

  async getWorkspace(id: string): Promise<Workspace | null> {
    const ref = doc(this.db, 'workspaces', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Workspace;
  }

  async saveWorkspace(ws: Workspace): Promise<void> {
    const ref = doc(this.db, 'workspaces', ws.id);
    await setDoc(ref, { ...ws, updatedAt: new Date() }, { merge: true });
  }

  // --- Snapshots ---

  async getSnapshot(workspaceId: string, dateKey: string): Promise<AuditItem[]> {
    const docId = `${workspaceId}_${dateKey}`;
    const ref = doc(this.db, 'snapshots_dias', docId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return [];
    const data = snap.data();
    return (data.items || []) as AuditItem[];
  }

  async saveSnapshot(workspaceId: string, dateKey: string, items: AuditItem[]): Promise<void> {
    const docId = `${workspaceId}_${dateKey}`;
    const ref = doc(this.db, 'snapshots_dias', docId);
    await setDoc(ref, {
      workspaceId,
      dateKey,
      items,
      updatedAt: new Date(),
    });
  }

  async getSnapshotDates(workspaceId: string): Promise<string[]> {
    const q = query(
      collection(this.db, 'snapshots_dias'),
      where('workspaceId', '==', workspaceId),
      orderBy('dateKey', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data().dateKey as string);
  }

  // --- Pendências ---

  async getPendencias(workspaceId: string, filters?: PendenciaFilters): Promise<Pendencia[]> {
    let q = query(
      collection(this.db, 'pendencias'),
      where('workspaceId', '==', workspaceId)
    );

    if (filters?.status && filters.status.length > 0) {
      q = query(q, where('status', 'in', filters.status));
    }

    const snap = await getDocs(q);
    let results = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Pendencia);

    // Client-side filters for fields not supported by compound queries
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

    return results;
  }

  async savePendencia(p: Pendencia): Promise<void> {
    const ref = doc(this.db, 'pendencias', p.id);
    await setDoc(ref, { ...p, updatedAt: new Date() });
  }

  async updatePendencia(id: string, changes: Partial<Pendencia>): Promise<void> {
    const ref = doc(this.db, 'pendencias', id);
    await updateDoc(ref, { ...changes, updatedAt: new Date() });
  }

  async deletePendencia(id: string): Promise<void> {
    const ref = doc(this.db, 'pendencias', id);
    await deleteDoc(ref);
  }

  // --- Log de Auditoria ---

  async logAuditChange(entry: AuditLogEntry): Promise<void> {
    await addDoc(collection(this.db, 'historico_auditoria'), entry);
  }

  async getAuditLog(workspaceId: string, auditItemId?: string): Promise<AuditLogEntry[]> {
    let q = query(
      collection(this.db, 'historico_auditoria'),
      where('workspaceId', '==', workspaceId),
      orderBy('timestamp', 'desc')
    );

    if (auditItemId) {
      q = query(q, where('auditItemId', '==', auditItemId));
    }

    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }) as AuditLogEntry);
  }

  // --- Transfer ---

  async exportPackage(workspaceId: string, periodo: DateRange): Promise<TransferPackage> {
    const ws = await this.getWorkspace(workspaceId);
    const config = ws?.config || createDefaultConfig();

    // Collect all snapshots in the date range
    const dates = await this.getSnapshotDates(workspaceId);
    const filteredDates = dates.filter(d => d >= periodo.inicio && d <= periodo.fim);

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
    // Group audit items by date
    const byDate = new Map<string, AuditItem[]>();
    for (const item of pkg.auditItems) {
      const existing = byDate.get(item.data) || [];
      existing.push(item);
      byDate.set(item.data, existing);
    }

    // Save snapshots
    for (const [dateKey, items] of byDate) {
      await this.saveSnapshot(pkg.workspaceId, dateKey, items);
    }

    // Save pendências
    for (const p of pkg.pendencias) {
      await this.savePendencia(p);
    }
  }
}
