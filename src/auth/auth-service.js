export const AUTHORIZED_EMAILS = Object.freeze([
  'operacional4@transpinho.com',
  'rh@transpinho.com',
  'tielle@transpinho.com'
]);

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function ensureAuthorized(email) {
  const normalized = normalizeEmail(email);
  if (!AUTHORIZED_EMAILS.includes(normalized)) {
    throw new Error('E-mail não autorizado');
  }
  return normalized;
}

export function createAuthService({ auth, signIn, signOut, subscribe }) {
  return {
    async login(email, password) {
      return signIn(auth, ensureAuthorized(email), password);
    },
    logout() {
      return signOut(auth);
    },
    subscribe(listener) {
      return subscribe(auth, listener);
    }
  };
}
