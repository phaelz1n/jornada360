import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { LoginScreen } from './components/LoginScreen.jsx';
import { buildDashboardData } from './dados/dashboard-data.js';
import { createAuthService, ensureVerifiedUser } from './auth/auth-service.js';

const AppShell = React.lazy(() => import('./components/AppShell.jsx').then(module => ({ default: module.AppShell })));

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
    let unsubscribe = () => {};
    Promise.all([
      import('./lib/firebase.js'),
      import('firebase/auth')
    ]).then(([firebase, firebaseAuth]) => {
      authServiceRef.current = createAuthService({
        auth: firebase.auth,
        signIn: firebaseAuth.signInWithEmailAndPassword,
        sendReset: firebaseAuth.sendPasswordResetEmail,
        signOut: firebaseAuth.signOut,
        subscribe: firebaseAuth.onAuthStateChanged
      });
      unsubscribe = authServiceRef.current.subscribe(async nextUser => {
        try { ensureVerifiedUser(nextUser); } catch (verificationError) {
          setUser(null);
          setDashboardData(null);
          setError('Verifique o e-mail da conta antes de acessar o Jornada360.');
          await firebaseAuth.signOut(firebase.auth);
          return;
        }
        setUser(nextUser);
        if (nextUser) {
          const { firestoreStore } = await import('./lib/firestore-store.js');
          setDashboardData(await buildDashboardData({ store: firestoreStore }));
        } else setDashboardData(null);
      });
    }).catch(caught => setError(authErrorMessage(caught)));
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
  return <React.Suspense fallback={<div className="boot-screen min-h-screen"><span className="loader"></span>Carregando Jornada360…</div>}><AppShell user={user} dashboardData={dashboardData} onLogout={() => authServiceRef.current.logout()} /></React.Suspense>;
}

createRoot(document.getElementById('root')).render(<App />);
