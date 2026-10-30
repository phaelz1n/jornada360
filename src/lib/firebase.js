import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
export { firebaseConfig } from './firebase-config.js';
import { firebaseConfig } from './firebase-config.js';

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
