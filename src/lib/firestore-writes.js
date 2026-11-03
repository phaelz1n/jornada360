import { doc, setDoc, writeBatch } from 'firebase/firestore';
import { firebaseApp } from './firebase.js';
import { getFirestore } from 'firebase/firestore';
import { createSnapshotWritePlan } from '../dados/snapshot-write-plan.js';
import { createImportSyncPlan } from '../dados/import-sync-plan.js';

const db = getFirestore(firebaseApp);

export async function saveImportRecord(record) {
  // A nova exportação do mesmo dia é uma correção/atualização, não um novo lançamento.
  // Usar a data como chave evita duplicidade e permite substituir o pacote inteiro.
  const ref = doc(db, 'importacoes', String(record.dateKey));
  await setDoc(ref, record);
  return ref.id;
}

export async function saveChecklistSnapshot(snapshot, dateKey = 'latest') {
  const ref = doc(db, 'checklist', dateKey);
  await setDoc(ref, { ...snapshot, updatedAt: new Date().toISOString() }, { merge: true });
  return ref.id;
}

export async function saveDriver(driver) {
  const id = encodeURIComponent(String(driver.nome || '').toLowerCase());
  await setDoc(doc(db, 'motoristas', id), { ...driver, updatedAt: new Date().toISOString() }, { merge: true });
  return id;
}

export async function saveOccurrence(event) {
  const id = `${event.dataKey}-${encodeURIComponent(String(event.motorista).toLowerCase())}-${Date.now()}`;
  await setDoc(doc(db, 'ocorrencias', id), { ...event, updatedAt: new Date().toISOString() });
  return id;
}

export async function saveProcessedDay(day) {
  // Sem merge de propósito: HE corrigida, batidas removidas e paradas atualizadas
  // precisam substituir o conteúdo anterior daquele dia.
  const batch = writeBatch(db);
  createSnapshotWritePlan(day).forEach(write => batch.set(doc(db, write.collection, write.id), write.data, write.merge ? { merge: true } : undefined));
  await batch.commit();
}

export async function saveImportAndProcessedDay(record, day) {
  const batch = writeBatch(db);
  createImportSyncPlan(record, day).forEach(write => batch.set(doc(db, write.collection, write.id), write.data, write.merge ? { merge: true } : undefined));
  await batch.commit();
}
