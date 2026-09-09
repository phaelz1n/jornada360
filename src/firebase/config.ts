/* Inicialização do Firebase SDK.
 *
 * Todas as credenciais vêm de variáveis de ambiente prefixadas com VITE_ — expostas
 * ao navegador pelo Vite. Nunca coloque chaves aqui diretamente.
 *
 * Configure no Vercel: Settings → Environment Variables com as mesmas chaves de .env.firebase.example
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/* Verifica se as credenciais foram configuradas. Se não, o modo demo continua funcionando
 * e o modo real mostrará um aviso. Isso evita crash na inicialização durante desenvolvimento
 * antes das variáveis de ambiente serem configuradas. */
export const firebaseConfigurado = !!(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  !firebaseConfig.apiKey.startsWith('AIzaSy...')
);

// Evita re-inicializar em hot-reload do Vite
const app = firebaseConfigurado
  ? (getApps().length === 0 ? initializeApp(firebaseConfig) : getApp())
  : null;

export const auth = firebaseConfigurado && app ? getAuth(app) : null;
export const db = firebaseConfigurado && app ? getFirestore(app) : null;

/* Em desenvolvimento com emuladores locais (opcional):
 * defina VITE_USE_FIREBASE_EMULATOR=true no .env para usar emuladores locais.
 * Isso evita custo e poluição de dados de produção durante desenvolvimento.
 *
 * Para ligar os emuladores: firebase emulators:start --only auth,firestore
 */
if (
  firebaseConfigurado &&
  auth &&
  db &&
  import.meta.env.DEV &&
  import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true'
) {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);
  console.info('[firebase] usando emuladores locais');
}

if (!firebaseConfigurado) {
  console.info(
    '[firebase] Credenciais não configuradas. ' +
    'Copie .env.firebase.example para .env e preencha com as chaves do seu projeto. ' +
    'O modo demonstração (localStorage) continua disponível.'
  );
}

export default app;
