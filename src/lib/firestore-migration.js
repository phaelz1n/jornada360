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
    await setDoc(doc(db, 'dias_processados', day.dateKey), day, { merge: true });
    await setDoc(doc(db, 'snapshots_dias', day.dateKey), day.snapshot, { merge: true });
    onProgress(++done, total);
  }
  const latest = payload.days.at(-1);
  if (latest) await setDoc(doc(db, 'snapshots_dias', 'latest'), latest.snapshot, { merge: true });
  onProgress(total, total);
  return { drivers: payload.drivers.length, days: payload.days.length };
}
