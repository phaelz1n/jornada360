import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as firebaseAuth from '../firebase/auth';
import { observarAuth } from '../firebase/auth';
import { firebaseConfigurado } from '../firebase/config';
import type { TenantDoUsuario, UsuarioAutenticado } from '../firebase/auth';

/* Dono da sessão do usuário: quem está logado, em quais empresas pode entrar, e o que pode fazer
 * em cada uma.
 *
 * TRÊS ESTADOS, NÃO DOIS. Além de "logado" e "não logado" existe "ainda não sei" — o Firebase
 * Auth verifica a sessão assincronamente (IndexedDB), e tratar esse intervalo como "não logado"
 * faria a tela de login piscar a cada recarga de página para quem já tem sessão válida.
 *
 * FIREBASE vs COOKIE: antes a sessão vivia em cookie HttpOnly (não visível ao JS). Agora o
 * Firebase Auth usa IndexedDB, com token JWT. A proteção CSRF explícita não é mais necessária
 * porque a sessão não viaja por cookie automático — cada requisição ao Firestore usa o SDK.
 *
 * A demonstração local continua funcionando sem Firebase — o modo demo usa localStorage e não
 * precisa de autenticação. */

export type EstadoSessao = 'verificando' | 'autenticado' | 'anonimo';
export type { TenantDoUsuario, UsuarioAutenticado };

interface AuthContextValue {
  estado: EstadoSessao;
  usuario: UsuarioAutenticado | null;
  tenants: TenantDoUsuario[];
  /** false = Firebase Auth não está disponível; só a demonstração local está disponível. */
  apiOnline: boolean;
  /** No Firebase, o cadastro é sempre aberto (sem programa piloto hardcoded no cliente). */
  cadastroAberto: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  entrarComGoogle: () => Promise<void>;
  registrar: (dados: { email: string; nome: string; senha: string; nomeEmpresa: string }) => Promise<{ usuario: UsuarioAutenticado; tenants: TenantDoUsuario[] }>;
  sair: () => Promise<void>;
  criarEmpresa: (nome: string) => Promise<TenantDoUsuario>;
  resgatarConvite: (codigo: string) => Promise<void>;
  aceitarConvite: (dados: { codigo: string; nome: string; senha: string }) => Promise<void>;
  recarregarSessao: () => Promise<void>;
  reconectar: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoSessao>('verificando');
  const [usuario, setUsuario] = useState<UsuarioAutenticado | null>(null);
  const [tenants, setTenants] = useState<TenantDoUsuario[]>([]);
  const [apiOnline, setApiOnline] = useState(false);
  const cadastroAberto = true; // Firebase: qualquer um pode criar conta

  const aplicar = useCallback((dados: { usuario: UsuarioAutenticado; tenants: TenantDoUsuario[] } | null) => {
    if (dados) {
      setUsuario(dados.usuario);
      setTenants(dados.tenants);
      setEstado('autenticado');
      setApiOnline(true);
    } else {
      setUsuario(null);
      setTenants([]);
      setEstado('anonimo');
    }
  }, []);

  /* Escuta mudanças do Firebase Auth (login, logout, token refresh). */
  useEffect(() => {
    if (!firebaseConfigurado) {
      setApiOnline(false);
      aplicar(null);
      return;
    }

    const unsubscribe = observarAuth(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          setApiOnline(true);
          const eu = await firebaseAuth.quemSouEu();
          aplicar(eu);
        } catch (err) {
          console.error('[observarAuth] Erro ao carregar dados do usuário:', err);
          aplicar(null);
        }
      } else {
        setApiOnline(true);
        aplicar(null);
      }
    });

    return unsubscribe;
  }, [aplicar]);

  const entrar = useCallback(async (email: string, senha: string) => {
    const r = await firebaseAuth.entrar(email, senha);
    aplicar({ usuario: r.usuario, tenants: r.tenants });
  }, [aplicar]);

  const entrarComGoogle = useCallback(async () => {
    const r = await firebaseAuth.entrarComGoogle();
    aplicar({ usuario: r.usuario, tenants: r.tenants });
  }, [aplicar]);

  const registrar = useCallback(async (dados: { email: string; nome: string; senha: string; nomeEmpresa: string }) => {
    const r = await firebaseAuth.registrar(dados);
    aplicar({ usuario: r.usuario, tenants: r.tenants });
    return r;
  }, [aplicar]);

  const sair = useCallback(async () => {
    await firebaseAuth.sair();
    aplicar(null);
  }, [aplicar]);

  const criarEmpresa = useCallback(async (nome: string) => {
    const tenant = await firebaseAuth.criarEmpresaRemota(nome);
    // Atualiza imediatamente o estado de tenants local para prevenir race conditions no WorkspaceContext
    setTenants((prev) => (prev.some((t) => t.id === tenant.id) ? prev : [...prev, tenant]));
    // Revalida assincronamente com o Firestore
    void firebaseAuth.quemSouEu().then((eu) => {
      if (eu) {
        const todos = eu.tenants.some((t) => t.id === tenant.id)
          ? eu.tenants
          : [...eu.tenants, tenant];
        aplicar({ usuario: eu.usuario, tenants: todos });
      }
    });
    return tenant;
  }, [aplicar]);

  /* Convites: funcionalidade pode ser implementada com Firestore em versão futura.
   * Por ora, um convite é um documento em /convites/{codigo} com email + tenantId + papel. */
  const resgatarConvite = useCallback(async (_codigo: string) => {
    console.warn('resgatarConvite: não implementado no modo Firebase ainda.');
  }, []);

  const aceitarConvite = useCallback(async (_dados: { codigo: string; nome: string; senha: string }) => {
    console.warn('aceitarConvite: não implementado no modo Firebase ainda.');
  }, []);

  const recarregarSessao = useCallback(async () => {
    const eu = await firebaseAuth.quemSouEu();
    aplicar(eu);
  }, [aplicar]);

  const reconectar = useCallback(async () => {
    try {
      const eu = await firebaseAuth.quemSouEu();
      aplicar(eu);
      return true;
    } catch {
      return false;
    }
  }, [aplicar]);

  const value = useMemo(
    () => ({ estado, usuario, tenants, apiOnline, cadastroAberto, entrar, entrarComGoogle, registrar, sair, criarEmpresa,
             resgatarConvite, aceitarConvite, recarregarSessao, reconectar }),
    [estado, usuario, tenants, apiOnline, cadastroAberto, entrar, entrarComGoogle, registrar, sair, criarEmpresa,
     resgatarConvite, aceitarConvite, recarregarSessao, reconectar],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}

export function mensagemDeErro(e: unknown): string {
  console.error('[Jornada360] Erro capturado:', e);
  if (e instanceof Error) {
    // Mapeia erros do Firebase para mensagens em português
    const msg = e.message;
    if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password') || msg.includes('auth/user-not-found')) {
      return 'E-mail ou senha incorretos.';
    }
    if (msg.includes('auth/email-already-in-use')) {
      return 'Já existe uma conta com este e-mail.';
    }
    if (msg.includes('auth/weak-password')) {
      return 'A senha é muito fraca. Use pelo menos 8 caracteres.';
    }
    if (msg.includes('auth/too-many-requests')) {
      return 'Muitas tentativas. Aguarde alguns minutos antes de tentar de novo.';
    }
    if (msg.includes('auth/configuration-not-found')) {
      return 'O Firebase Authentication ainda não foi ativado no seu projeto Firebase. Acesse o Firebase Console > Authentication e clique em "Vamos começar" (Get started) ativando os provedores E-mail/Senha e Google.';
    }
    if (msg.includes('auth/popup-closed-by-user')) {
      return 'A janela de login foi fechada antes de concluir.';
    }
    if (msg.includes('auth/unauthorized-domain')) {
      return 'Este domínio não está autorizado no Firebase Authentication. Adicione localhost e jornada360.phaelz.com em Authentication > Configurações > Domínios autorizados.';
    }
    if (msg.includes('permission-denied') || msg.includes('Missing or insufficient permissions')) {
      return 'Permissão negada pelo banco de dados Firestore. Publique as regras de segurança no Firebase Console > Firestore Database > Rules.';
    }
    return e.message;
  }
  return 'Não foi possível concluir. Tente novamente.';
}
