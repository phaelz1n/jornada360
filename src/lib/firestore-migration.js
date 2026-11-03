import { doc, getFirestore, setDoc, writeBatch } from 'firebase/firestore';
import { firebaseApp, auth } from './firebase.js';
import { buildMigrationAudit } from '../dados/migration-audit.js';

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
    const batch = writeBatch(db);
    batch.set(doc(db, 'dias_processados', day.dateKey), { ...day, snapshot }, { merge: false });
    batch.set(doc(db, 'snapshots_dias', day.dateKey), snapshot, { merge: false });
    if (day.caseState && Object.keys(day.caseState).length) {
      batch.set(doc(db, 'checklist', day.dateKey), { dateKey: day.dateKey, caseState: day.caseState, migratedAt: new Date().toISOString() }, { merge: true });
    }
    await batch.commit();
    onProgress(++done, total);
  }
  const latest = payload.days.at(-1);
  if (latest) await setDoc(doc(db, 'snapshots_dias', 'latest'), { ...(latest.snapshot || {}), dateKey: latest.dateKey }, { merge: false });
  const auditId = `migration-${Date.now()}`;
  await setDoc(doc(db, 'historico_auditoria', auditId), buildMigrationAudit(payload, auth.currentUser?.email));
  onProgress(total, total);
  return { drivers: payload.drivers.length, days: payload.days.length };
}
