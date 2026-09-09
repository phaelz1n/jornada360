/* Wrapper de autenticação Firebase.
 *
 * Fornece autenticação completa via Firebase Authentication + Firestore:
 * - E-mail e Senha (login, cadastro, recuperação)
 * - Login com Google (GoogleAuthProvider popup)
 * - Persistência automática em IndexedDB e monitoramento via onAuthStateChanged
 * - Vínculo multitenant de empresas por usuário no Firestore
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset,
  onAuthStateChanged,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from './config';

export interface UsuarioAutenticado {
  id: string;
  email: string;
  nome: string;
  fotoUrl?: string | null;
}

export type PapelUsuario = 'administrador' | 'rh' | 'gestor' | 'auditor' | 'colaborador';

export interface TenantDoUsuario {
  id: string;
  nome: string;
  environment: 'real' | 'demo';
  papel: PapelUsuario;
  permissoes: string[];
  status?: 'ativa' | 'suspensa';
}

/** Converte o usuário do Firebase Auth para o tipo interno da aplicação. */
function mapUser(firebaseUser: User): UsuarioAutenticado {
  return {
    id: firebaseUser.uid,
    email: firebaseUser.email ?? '',
    nome: firebaseUser.displayName ?? firebaseUser.email?.split('@')[0] ?? 'Usuário',
    fotoUrl: firebaseUser.photoURL ?? null,
  };
}

function assertAuth() {
  if (!auth || !db) throw new Error('Firebase não está configurado. Configure as variáveis VITE_FIREBASE_* no arquivo .env.');
  return { auth, db };
}

/** Lê os tenants do usuário a partir do Firestore. */
async function carregarTenants(uid: string): Promise<TenantDoUsuario[]> {
  const { db: firestoreDb } = assertAuth();
  
  // 1. Busca no índice: user_memberships/{uid}/tenants/{tenantId}
  const userTenantsRef = collection(firestoreDb, 'user_memberships', uid, 'tenants');
  const snap = await getDocs(userTenantsRef);

  const tenants: TenantDoUsuario[] = [];

  for (const memberDoc of snap.docs) {
    const { tenantId, papel } = memberDoc.data() as { tenantId: string; papel: PapelUsuario };
    const tenantSnap = await getDoc(doc(firestoreDb, 'tenants', tenantId));
    if (!tenantSnap.exists()) continue;
    const tenantData = tenantSnap.data();

    tenants.push({
      id: tenantId,
      nome: tenantData.nome ?? '',
      environment: tenantData.environment ?? 'real',
      papel: papel ?? 'administrador',
      permissoes: [],
      status: tenantData.status ?? 'ativa',
    });
  }

  // 2. Fallback: busca por criador caso ainda não esteja no índice
  if (tenants.length === 0) {
    const q = query(collection(firestoreDb, 'tenants'), where('criadoPor', '==', uid));
    const createdSnap = await getDocs(q).catch(() => null);
    if (createdSnap && !createdSnap.empty) {
      for (const tDoc of createdSnap.docs) {
        const tData = tDoc.data();
        tenants.push({
          id: tDoc.id,
          nome: tData.nome ?? '',
          environment: tData.environment ?? 'real',
          papel: 'administrador',
          permissoes: [],
          status: tData.status ?? 'ativa',
        });
        // Sincroniza índice para consultas futuras
        await setDoc(doc(firestoreDb, 'user_memberships', uid, 'tenants', tDoc.id), {
          tenantId: tDoc.id,
          papel: 'administrador',
          criadoEm: serverTimestamp(),
        }).catch(() => {});
      }
    }
  }

  return tenants;
}

/** Cria o tenant no Firestore e vincula ao usuário. */
async function criarTenantFirestore(
  uid: string,
  nomeEmpresa: string,
  papel: PapelUsuario = 'administrador',
): Promise<TenantDoUsuario> {
  const { db: firestoreDb } = assertAuth();
  const tenantId = `tenant-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  // Documento do tenant
  await setDoc(doc(firestoreDb, 'tenants', tenantId), {
    nome: nomeEmpresa.trim(),
    environment: 'real',
    status: 'ativa',
    criadoEm: serverTimestamp(),
    criadoPor: uid,
    configVersao: serverTimestamp(),
  });

  // Membership: tenant → usuário
  await setDoc(doc(firestoreDb, 'tenants', tenantId, 'memberships', uid), {
    papel,
    criadoEm: serverTimestamp(),
  });

  // Índice inverso: usuário → tenants (para carregarTenants ser rápido)
  await setDoc(doc(firestoreDb, 'user_memberships', uid, 'tenants', tenantId), {
    tenantId,
    papel,
    criadoEm: serverTimestamp(),
  });

  return {
    id: tenantId,
    nome: nomeEmpresa.trim(),
    environment: 'real',
    papel,
    permissoes: [],
    status: 'ativa',
  };
}

// ---- Funções públicas --------------------------------------------------------

export async function registrar(dados: {
  email: string;
  nome: string;
  senha: string;
  nomeEmpresa: string;
}): Promise<{ usuario: UsuarioAutenticado; tenants: TenantDoUsuario[] }> {
  const { auth: firebaseAuth, db: firestoreDb } = assertAuth();
  const { user } = await createUserWithEmailAndPassword(firebaseAuth, dados.email, dados.senha);

  await updateProfile(user, { displayName: dados.nome.trim() });

  await setDoc(doc(firestoreDb, 'users', user.uid), {
    email: dados.email,
    nome: dados.nome.trim(),
    criadoEm: serverTimestamp(),
    ativo: true,
  });

  const tenant = await criarTenantFirestore(user.uid, dados.nomeEmpresa);

  return {
    usuario: mapUser(user),
    tenants: [tenant],
  };
}

export async function entrar(
  email: string,
  senha: string,
): Promise<{ usuario: UsuarioAutenticado; tenants: TenantDoUsuario[] }> {
  const { auth: firebaseAuth } = assertAuth();
  const { user } = await signInWithEmailAndPassword(firebaseAuth, email, senha);
  const tenants = await carregarTenants(user.uid);
  return { usuario: mapUser(user), tenants };
}

/** Autenticação com o Google via popup */
export async function entrarComGoogle(): Promise<{ usuario: UsuarioAutenticado; tenants: TenantDoUsuario[] }> {
  const { auth: firebaseAuth, db: firestoreDb } = assertAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(firebaseAuth, provider);
  const user = result.user;

  // Garante que o documento do usuário existe no Firestore
  const userDocRef = doc(firestoreDb, 'users', user.uid);
  const userSnap = await getDoc(userDocRef);
  if (!userSnap.exists()) {
    await setDoc(userDocRef, {
      email: user.email ?? '',
      nome: user.displayName ?? user.email?.split('@')[0] ?? 'Usuário',
      fotoUrl: user.photoURL ?? null,
      criadoEm: serverTimestamp(),
      ativo: true,
    });
  }

  let tenants = await carregarTenants(user.uid);
  if (tenants.length === 0) {
    const nomeEmpresa = user.displayName
      ? `Empresa de ${user.displayName.split(' ')[0]}`
      : 'Minha Empresa';
    const initialTenant = await criarTenantFirestore(user.uid, nomeEmpresa);
    tenants = [initialTenant];
  }

  return { usuario: mapUser(user), tenants };
}

export async function sair(): Promise<void> {
  if (!auth) return;
  try {
    await signOut(auth);
  } catch {
    // Silencioso
  }
}

export async function quemSouEu(): Promise<{ usuario: UsuarioAutenticado; tenants: TenantDoUsuario[] } | null> {
  if (!auth) return null;
  const user = auth.currentUser;
  if (!user) return null;
  try {
    const tenants = await carregarTenants(user.uid);
    return { usuario: mapUser(user), tenants };
  } catch {
    return { usuario: mapUser(user), tenants: [] };
  }
}

export async function criarEmpresaRemota(nome: string): Promise<TenantDoUsuario> {
  const { auth: firebaseAuth } = assertAuth();
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error('Usuário não autenticado.');
  return criarTenantFirestore(user.uid, nome);
}

/** Monitora mudanças de autenticação — usado pelo AuthContext. */
export function observarAuth(callback: (user: User | null) => void): () => void {
  if (!auth) {
    setTimeout(() => callback(null), 0);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

/** Recuperação de senha via Firebase (link por e-mail). */
export async function pedirRecuperacao(email: string): Promise<{ ok: true; mensagem: string }> {
  const { auth: firebaseAuth } = assertAuth();
  await sendPasswordResetEmail(firebaseAuth, email);
  return {
    ok: true,
    mensagem: 'Se existir uma conta com este e-mail, o link de redefinição foi enviado. Confira sua caixa de entrada e o spam.',
  };
}

/** Valida o código do link de redefinição enviado pelo Firebase. */
export async function verificarLinkRecuperacao(codigo: string): Promise<string> {
  const { auth: firebaseAuth } = assertAuth();
  return await verifyPasswordResetCode(firebaseAuth, codigo);
}

/** Confirma a troca de senha com o código recebido pelo Firebase. */
export async function redefinirSenha(codigo: string, novaSenha: string): Promise<void> {
  const { auth: firebaseAuth } = assertAuth();
  await confirmPasswordReset(firebaseAuth, codigo, novaSenha);
}

export { carregarTenants };
