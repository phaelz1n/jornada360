// ============================================================
// Data Adapter Factory
// ============================================================

import type { IDataAdapter } from './adapter';
import { isFirebaseConfigured } from '@/lib/firebase';

let _adapter: IDataAdapter | null = null;

/**
 * Retorna o adapter de persistência correto:
 * - FirestoreAdapter se as env vars do Firebase estiverem configuradas
 * - IndexedDBAdapter caso contrário (modo offline)
 *
 * Singleton: reutiliza a mesma instância após a primeira chamada.
 */
export async function getAdapter(): Promise<IDataAdapter> {
  if (_adapter) return _adapter;

  if (isFirebaseConfigured()) {
    const { FirestoreAdapter } = await import('./firestore-adapter');
    _adapter = new FirestoreAdapter();
  } else {
    const { IndexedDBAdapter } = await import('./indexeddb-adapter');
    _adapter = new IndexedDBAdapter();
  }

  return _adapter;
}

/**
 * Verifica se o sistema está operando em modo offline (sem Firestore).
 */
export function isOfflineMode(): boolean {
  return !isFirebaseConfigured();
}

// Re-export the interface
export type { IDataAdapter } from './adapter';
