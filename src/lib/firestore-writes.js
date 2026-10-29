import { doc, setDoc } from 'firebase/firestore';
import { firebaseApp } from './firebase.js';
import { getFirestore } from 'firebase/firestore';

const db = getFirestore(firebaseApp);

export async function saveImportRecord(record) {
  const ref = doc(db, 'importacoes', `${record.dateKey}-${Date.now()}`);
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
  await setDoc(doc(db, 'dias_processados', day.dateKey), day, { merge: true });
  await setDoc(doc(db, 'snapshots_dias', day.dateKey), { ...day, items: day.items }, { merge: true });
  await setDoc(doc(db, 'snapshots_dias', 'latest'), { ...day, items: day.items }, { merge: true });
}
