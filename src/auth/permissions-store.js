import { firestoreStore } from '../lib/firestore-store.js';
import { saveSystemPermission } from '../lib/firestore-writes.js';
import { asArray } from '../utils/collections.js';

export function subscribeSystemPermissions(onChange, onError) {
  return firestoreStore.subscribe('permissoes_sistemas', records => {
    onChange(asArray(records).reduce((map, item) => ({ ...map, [item.email]: item }), {}));
  }, onError);
}

export async function loadSystemPermission(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;
  const record = await firestoreStore.get(`permissoes_sistemas/${encodeURIComponent(normalized)}`);
  return record ? { [normalized]: record } : {};
}

export function persistSystemPermission(permission, actorEmail) {
  return saveSystemPermission(permission, actorEmail);
}
