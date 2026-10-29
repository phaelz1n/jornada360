export const AUTHORIZED_EMAILS = Object.freeze([
  'operacional4@transpinho.com',
  'rh@transpinho.com',
  'tielle@transpinho.com'
]);

function ensureAuthorized(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!AUTHORIZED_EMAILS.includes(normalized)) throw new Error('E-mail não autorizado');
  return normalized;
}

export function createAuthActions({ auth, signIn, signUp }) {
  return {
    auth,
    login(email, password) { return signIn(auth, ensureAuthorized(email), password); },
    signup(email, password) { return signUp(auth, ensureAuthorized(email), password); }
  };
}

