'use client';

// ============================================================
// Firebase Auth Provider
// ============================================================

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from '@/lib/firebase';

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isFirebase: boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  signUp: (email: string, pass: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  isFirebase: false,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFirebase, setIsFirebase] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setIsFirebase(false);
      setLoading(false);
      return;
    }

    setIsFirebase(true);
    try {
      const auth = getFirebaseAuth();
      const unsubscribe = onAuthStateChanged(auth, currentUser => {
        setUser(currentUser);
        setLoading(false);
      });
      return () => unsubscribe();
    } catch (err) {
      console.error('Erro ao inicializar Firebase Auth:', err);
      setLoading(false);
    }
  }, []);

  const signIn = async (email: string, pass: string) => {
    if (!isFirebaseConfigured()) {
      throw new Error('Firebase não está configurado.');
    }
    const auth = getFirebaseAuth();
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const signUp = async (email: string, pass: string) => {
    if (!isFirebaseConfigured()) {
      throw new Error('Firebase não está configurado.');
    }
    const auth = getFirebaseAuth();
    await createUserWithEmailAndPassword(auth, email, pass);
  };

  const signOut = async () => {
    if (isFirebaseConfigured()) {
      const auth = getFirebaseAuth();
      await firebaseSignOut(auth);
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isFirebase,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
