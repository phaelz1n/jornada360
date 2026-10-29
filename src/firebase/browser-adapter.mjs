import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js';
import { getFirestore, doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';
import { firebaseConfig } from './config.mjs';
import { createFirestoreStore } from './firestore-store.mjs';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const store = createFirestoreStore({ db, doc, getDoc, setDoc });

export { app, db, store };
window.Jornada360Firebase = { app, db, store };

