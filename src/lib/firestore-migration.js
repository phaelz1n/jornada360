import { doc, getFirestore, setDoc } from 'firebase/firestore';
import { firebaseApp } from './firebase.js';

const db = getFirestore(firebaseApp);

export async function migrateBackupToFirestore(payload, onProgress = () => {}) {
  const total = payload.drivers.length + payload.days.length + 1;
  let done = 0;
  for (const driver of payload.drivers) {
    const id = encodeURIComponent(driver.nome.toLowerCase());
    await setDoc(doc(db, 'motoristas', id), driver, { merge: true });
    onProgress(++done, total);
  }
  for (const day of payload.days) {
    const snapshot = { ...(day.snapshot || {}), dateKey: day.dateKey };
    // Cada dia tem sua própria chave e precisa manter a data dentro do documento
    // para a listagem do dashboard recuperar o registro inteiro.
    await setDoc(doc(db, 'dias_processados', day.dateKey), { ...day, snapshot }, { merge: false });
    await setDoc(doc(db, 'snapshots_dias', day.dateKey), snapshot, { merge: false });
    if (day.caseState && Object.keys(day.caseState).length) {
      await setDoc(doc(db, 'checklist', day.dateKey), { dateKey: day.dateKey, caseState: day.caseState, migratedAt: new Date().toISOString() }, { merge: true });
    }
    onProgress(++done, total);
  }
  const latest = payload.days.at(-1);
  if (latest) await setDoc(doc(db, 'snapshots_dias', 'latest'), { ...(latest.snapshot || {}), dateKey: latest.dateKey }, { merge: false });
  onProgress(total, total);
  return { drivers: payload.drivers.length, days: payload.days.length };
}
