export function createAuthActions({ auth, signIn, signUp }) {
  return {
    auth,
    login(email, password) { return signIn(auth, email, password); },
    signup(email, password) { return signUp(auth, email, password); }
  };
}

