import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

export const firebaseConfig = Object.freeze({
  apiKey: 'AIzaSyDIB4UxoVHIUDRrfaOQppszXt_kQk7mUUE',
  authDomain: 'jornada360-3fb60.firebaseapp.com',
  projectId: 'jornada360-3fb60',
  storageBucket: 'jornada360-3fb60.firebasestorage.app',
  messagingSenderId: '614708163243',
  appId: '1:614708163243:web:ad8123f025866e909c3dee'
});

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
