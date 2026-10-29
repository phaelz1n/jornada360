import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { LoginScreen } from './components/LoginScreen.jsx';
import { AppShell } from './components/AppShell.jsx';
import { buildDashboardData } from './dados/dashboard-data.js';

function authErrorMessage(error) {
  if (error?.message === 'E-mail não autorizado') return error.message;
  if (error?.code === 'auth/invalid-credential' || error?.code === 'auth/wrong-password') return 'E-mail ou senha incorretos.';
  if (error?.code === 'auth/too-many-requests') return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  return 'Não foi possível entrar agora. Verifique sua conexão e tente novamente.';
}

function App() {
  const authServiceRef = React.useRef(null);
  const [user, setUser] = React.useState(null);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [dashboardData, setDashboardData] = React.useState(null);

  React.useEffect(() => {
    let unsubscribe = () => {};
    Promise.all([
      import('./lib/firebase.js'),
      import('firebase/auth'),
      import('./auth/auth-service.js')
    ]).then(([firebase, firebaseAuth, serviceModule]) => {
      authServiceRef.current = serviceModule.createAuthService({
        auth: firebase.auth,
        signIn: firebaseAuth.signInWithEmailAndPassword,
        signOut: firebaseAuth.signOut,
        subscribe: firebaseAuth.onAuthStateChanged
      });
      unsubscribe = authServiceRef.current.subscribe(async nextUser => {
        setUser(nextUser);
        if (nextUser) {
          const { firestoreStore } = await import('./lib/firestore-store.js');
          setDashboardData(await buildDashboardData({ store: firestoreStore }));
        } else setDashboardData(null);
      });
    }).catch(caught => setError(authErrorMessage(caught)));
    return () => unsubscribe();
  }, []);

  React.useEffect(() => {
    const refresh = event => setDashboardData({ items: event.detail?.items || [], source: 'firebase' });
    window.addEventListener('jornada360:data-updated', refresh);
    return () => window.removeEventListener('jornada360:data-updated', refresh);
  }, []);

  async function handleLogin(email, password) {
    if (!authServiceRef.current) {
      setError('Conectando ao Firebase. Tente novamente em alguns segundos.');
      return;
    }
    setLoading(true);
    setError('');
    try { await authServiceRef.current.login(email, password); }
    catch (caught) { setError(authErrorMessage(caught)); }
    finally { setLoading(false); }
  }

  if (!user) return <LoginScreen onLogin={handleLogin} loading={loading} error={error} />;
  return <AppShell user={user} dashboardData={dashboardData} onLogout={() => authServiceRef.current.logout()} />;
}

createRoot(document.getElementById('root')).render(<App />);
