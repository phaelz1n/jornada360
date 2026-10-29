import { collection, doc, getDocs, getDoc, getFirestore, onSnapshot } from 'firebase/firestore';
import { firebaseApp } from './firebase.js';

const db = getFirestore(firebaseApp);

export const firestoreStore = Object.freeze({
  async get(path) {
    const snapshot = await getDoc(doc(db, ...path.split('/')));
    return snapshot.exists() ? snapshot.data() : undefined;
  },
  async list(path) {
    const snapshot = await getDocs(collection(db, path));
    return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
  },
  subscribe(path, listener) {
    return onSnapshot(collection(db, path), snapshot => listener(snapshot.docs.map(item => ({ id: item.id, ...item.data() }))));
  }
});
