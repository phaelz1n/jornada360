import { doc, setDoc } from 'firebase/firestore';
import { firebaseApp } from './firebase.js';
import { getFirestore } from 'firebase/firestore';

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

export async function saveProcessedDay(day) {
  // Sem merge de propósito: HE corrigida, batidas removidas e paradas atualizadas
  // precisam substituir o conteúdo anterior daquele dia.
  await setDoc(doc(db, 'dias_processados', day.dateKey), day);
  await setDoc(doc(db, 'snapshots_dias', day.dateKey), { ...day, items: day.items });
  await setDoc(doc(db, 'snapshots_dias', 'latest'), { ...day, items: day.items }, { merge: true });
}
