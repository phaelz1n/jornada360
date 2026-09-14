// ============================================================
// Firebase Initialization (Client-Side Only)
// ============================================================

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let _app: FirebaseApp | null = null;
let _db: Firestore | null = null;

/**
 * Verifica se as variáveis de ambiente do Firebase estão configuradas.
 */
export function isFirebaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  );
}

/**
 * Retorna a instância do Firebase App (singleton).
 */
export function getFirebaseApp(): FirebaseApp {
  if (_app) return _app;
  _app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  return _app;
}

/**
 * Retorna a instância do Firestore com persistência IndexedDB multi-tab.
 */
export function getFirestore(): Firestore {
  if (_db) return _db;
  const app = getFirebaseApp();
  _db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
  return _db;
}
