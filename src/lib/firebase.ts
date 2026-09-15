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
import { getAuth, type Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDIB4UxoVHIUDRrfaOQppszXt_kQk7mUUE",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "jornada360-3fb60.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "jornada360-3fb60",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "jornada360-3fb60.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "614708163243",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:614708163243:web:ad8123f025866e909c3dee",
};

let _app: FirebaseApp | null = null;
let _db: Firestore | null = null;
let _auth: Auth | null = null;

/**
 * Verifica se as variáveis de ambiente do Firebase estão configuradas.
 */
export function isFirebaseConfigured(): boolean {
  return !!(
    (process.env.NEXT_PUBLIC_FIREBASE_API_KEY || firebaseConfig.apiKey) &&
    (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || firebaseConfig.projectId)
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

/**
 * Retorna a instância do Firebase Auth (singleton).
 */
export function getFirebaseAuth(): Auth {
  if (_auth) return _auth;
  const app = getFirebaseApp();
  _auth = getAuth(app);
  return _auth;
}

