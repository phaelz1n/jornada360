import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { firebaseApp } from './firebase.js';

const db = getFirestore(firebaseApp);

export const firestoreStore = Object.freeze({
  async get(path) {
    const snapshot = await getDoc(doc(db, ...path.split('/')));
    return snapshot.exists() ? snapshot.data() : undefined;
  }
});
