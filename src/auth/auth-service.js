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

export function createAuthService({ auth, signIn, sendReset, signOut, subscribe }) {
  return {
    async login(email, password) {
      return signIn(auth, ensureAuthorized(email), password);
    },
    async resetPassword(email) {
      if (!sendReset) throw new Error('Redefinição de senha indisponível');
      return sendReset(auth, ensureAuthorized(email));
    },
    logout() {
      return signOut(auth);
    },
    subscribe(listener) {
      return subscribe(auth, listener);
    }
  };
}
