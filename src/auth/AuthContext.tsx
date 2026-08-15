import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { aoExpirarSessao, apiDisponivel, ErroApi } from '../api/client';
import * as authService from '../api/authService';
import type { TenantDoUsuario, UsuarioAutenticado } from '../api/authService';

/* Dono da sessão do usuário: quem está logado, em quais empresas pode entrar, e o que pode fazer
 * em cada uma.
 *
 * TRÊS ESTADOS, NÃO DOIS. Além de "logado" e "não logado" existe "ainda não sei" — a checagem
 * inicial contra o servidor leva alguns milissegundos, e tratar esse intervalo como "não logado"
 * faria a tela de login piscar a cada recarga de página para quem já tem sessão válida.
 *
 * A DISPONIBILIDADE DA API é parte do estado por uma razão de produto: a demonstração precisa
 * funcionar com o servidor desligado. Quando a API não responde, o aplicativo não mostra erro —
 * mostra o caminho da demonstração e diz honestamente que a área de empresas exige servidor. */

export type EstadoSessao = 'verificando' | 'autenticado' | 'anonimo';

interface AuthContextValue {
  estado: EstadoSessao;
  usuario: UsuarioAutenticado | null;
  tenants: TenantDoUsuario[];
  /** false = servidor fora do ar; só a demonstração local está disponível. */
  apiOnline: boolean;
  /** false = programa piloto com entrada por convite; o portão não oferece "criar empresa". */
  cadastroAberto: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  registrar: (dados: { email: string; nome: string; senha: string; nomeEmpresa: string }) => Promise<void>;
  sair: () => Promise<void>;
  criarEmpresa: (nome: string) => Promise<TenantDoUsuario>;
  resgatarConvite: (codigo: string) => Promise<void>;
  /** Cria a conta a partir de um convite (para quem ainda não tem conta) e já entra. */
  aceitarConvite: (dados: { codigo: string; nome: string; senha: string }) => Promise<void>;
  /** Relê a sessão do servidor. Usado após mudanças que alteram a lista de empresas. */
  recarregarSessao: () => Promise<void>;
  reconectar: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoSessao>('verificando');
  const [usuario, setUsuario] = useState<UsuarioAutenticado | null>(null);
  const [tenants, setTenants] = useState<TenantDoUsuario[]>([]);
  const [apiOnline, setApiOnline] = useState(false);
  /* Começa fechado: enquanto o servidor não responde, oferecer "criar minha empresa" seria
   * prometer o que talvez não exista. É a suposição que erra para o lado menos frustrante. */
  const [cadastroAberto, setCadastroAberto] = useState(false);

  const aplicar = useCallback((dados: { usuario: UsuarioAutenticado; tenants: TenantDoUsuario[] } | null) => {
    if (dados) {
      setUsuario(dados.usuario);
      setTenants(dados.tenants);
      setEstado('autenticado');
    } else {
      setUsuario(null);
      setTenants([]);
      setEstado('anonimo');
    }
  }, []);

  const verificar = useCallback(async () => {
    const online = await apiDisponivel();
    setApiOnline(online);
    if (!online) {
      /* Sem servidor não há como afirmar que a pessoa está logada. Declarar "anônimo" é a
       * descrição correta do que se sabe, e é o que libera o caminho da demonstração. */
      setCadastroAberto(false);
      aplicar(null);
      return;
    }
    setCadastroAberto(await authService.modoDeCadastro());
    aplicar(await authService.quemSouEu());
  }, [aplicar]);

  useEffect(() => {
    void verificar();
  }, [verificar]);

  /* Qualquer requisição que receba 401 derruba a sessão inteira, venha de onde vier. Sem isso,
   * uma sessão expirada deixaria a interface montada com dados velhos e todo clique falhando em
   * silêncio. */
  useEffect(() => aoExpirarSessao(() => aplicar(null)), [aplicar]);

  const entrar = useCallback(async (email: string, senha: string) => {
    const r = await authService.entrar(email, senha);
    setApiOnline(true);
    aplicar({ usuario: r.usuario, tenants: r.tenants });
  }, [aplicar]);

  const registrar = useCallback(async (dados: { email: string; nome: string; senha: string; nomeEmpresa: string }) => {
    const r = await authService.registrar(dados);
    setApiOnline(true);
    aplicar({ usuario: r.usuario, tenants: r.tenants });
  }, [aplicar]);

  const sair = useCallback(async () => {
    await authService.sair();
    aplicar(null);
  }, [aplicar]);

  const criarEmpresa = useCallback(async (nome: string) => {
    const tenant = await authService.criarEmpresaRemota(nome);
    /* Relê do servidor em vez de acrescentar à lista local: o papel e as permissões da empresa
     * nova vêm de lá, e inventá-los aqui criaria uma segunda fonte de verdade sobre acesso. */
    const eu = await authService.quemSouEu();
    if (eu) aplicar(eu);
    return tenant;
  }, [aplicar]);

  const resgatarConvite = useCallback(async (codigo: string) => {
    const r = await authService.resgatarConvite(codigo);
    setTenants(r.tenants);
  }, []);

  const aceitarConvite = useCallback(async (dados: { codigo: string; nome: string; senha: string }) => {
    const r = await authService.aceitarConvite(dados);
    setApiOnline(true);
    aplicar({ usuario: r.usuario, tenants: r.tenants });
  }, [aplicar]);

  const recarregarSessao = useCallback(async () => {
    const eu = await authService.quemSouEu();
    aplicar(eu);
  }, [aplicar]);

  const reconectar = useCallback(async () => {
    const online = await apiDisponivel();
    setApiOnline(online);
    if (online) {
      setCadastroAberto(await authService.modoDeCadastro());
      aplicar(await authService.quemSouEu());
    }
    return online;
  }, [aplicar]);

  const value = useMemo(
    () => ({ estado, usuario, tenants, apiOnline, cadastroAberto, entrar, registrar, sair, criarEmpresa,
             resgatarConvite, aceitarConvite, recarregarSessao, reconectar }),
    [estado, usuario, tenants, apiOnline, cadastroAberto, entrar, registrar, sair, criarEmpresa,
     resgatarConvite, aceitarConvite, recarregarSessao, reconectar],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}

/* Traduz o erro da API para uma frase que cabe embaixo de um campo de formulário. Fica aqui, e não
 * em cada tela, para que "e-mail já em uso" tenha sempre o mesmo texto. */
export function mensagemDeErro(e: unknown): string {
  if (e instanceof ErroApi) return e.message;
  return 'Não foi possível concluir. Tente novamente.';
}
