import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { LoginScreen } from './components/LoginScreen.jsx';
import { buildDashboardData } from './dados/dashboard-data.js';
import { createAuthService, ensureVerifiedUser } from './auth/auth-service.js';
import { AppShell } from './components/AppShell.jsx';
import { auth } from './lib/firebase.js';
import { firestoreStore } from './lib/firestore-store.js';
import { onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth';

function authErrorMessage(error) {
  if (error?.message === 'E-mail não autorizado') return error.message;
  if (error?.message === 'E-mail não verificado') return 'Verifique o e-mail da conta antes de acessar o Jornada360.';
  if (error?.code === 'auth/invalid-credential' || error?.code === 'auth/wrong-password') return 'E-mail ou senha incorretos.';
  if (error?.code === 'auth/too-many-requests') return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  return 'Não foi possível entrar agora. Verifique sua conexão e tente novamente.';
}

function App() {
  const authServiceRef = React.useRef(null);
  const [user, setUser] = React.useState(null);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [dashboardData, setDashboardData] = React.useState(null);

  React.useEffect(() => {
    authServiceRef.current = createAuthService({
      auth,
      signIn: signInWithEmailAndPassword,
      sendReset: sendPasswordResetEmail,
      signOut,
      subscribe: onAuthStateChanged
    });
    const unsubscribe = authServiceRef.current.subscribe(async nextUser => {
      try {
        if (nextUser?.reload) await nextUser.reload();
        ensureVerifiedUser(nextUser);
      } catch (verificationError) {
        setUser(null);
        setDashboardData(null);
        setError('Verifique o e-mail da conta antes de acessar o Jornada360.');
        await signOut(auth);
        return;
      }
      setUser(nextUser);
      if (nextUser) {
        setDashboardData(await buildDashboardData({ store: firestoreStore }));
      } else setDashboardData(null);
    }, error => setError(authErrorMessage(error)));
    return () => unsubscribe();
  }, []);

  async function handleLogin(email, password) {
    if (!authServiceRef.current) {
      setError('Conectando ao Firebase. Tente novamente em alguns segundos.');
      return;
    }
    setLoading(true);
    setError('');
    setNotice('');
    try { await authServiceRef.current.login(email, password); }
    catch (caught) { setError(authErrorMessage(caught)); }
    finally { setLoading(false); }
  }

  async function handleResetPassword(email) {
    if (!authServiceRef.current) { setError('Conectando ao Firebase. Tente novamente em alguns segundos.'); return; }
    setError('');
    setNotice('');
    try {
      await authServiceRef.current.resetPassword(email);
      setNotice('Se o e-mail estiver autorizado, enviamos o link de redefinição.');
    } catch (caught) { setError(authErrorMessage(caught)); }
  }

  if (!user) return <LoginScreen onLogin={handleLogin} onResetPassword={handleResetPassword} loading={loading} error={error} notice={notice} />;
  return <AppShell user={user} dashboardData={dashboardData} onLogout={() => authServiceRef.current.logout()} />;
}

createRoot(document.getElementById('root')).render(<App />);
