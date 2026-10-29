import { doc, setDoc } from 'firebase/firestore';
import { firebaseApp } from './firebase.js';
import { getFirestore } from 'firebase/firestore';

const db = getFirestore(firebaseApp);

export async function saveImportRecord(record) {
  const ref = doc(db, 'importacoes', `${record.dateKey}-${Date.now()}`);
  await setDoc(ref, record);
  return ref.id;
}
