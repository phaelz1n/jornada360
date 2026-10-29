import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';
import { app } from './browser-adapter.mjs';
import { createAuthActions } from './auth-actions.mjs';

const auth = getAuth(app);
const actions = createAuthActions({ auth, signIn: signInWithEmailAndPassword, signUp: createUserWithEmailAndPassword });
export { auth, actions, onAuthStateChanged };

