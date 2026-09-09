import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { WorkspaceRepository } from '../repositories/WorkspaceRepository';
import { seedDemoWorkspaceIfEmpty } from '../demo/seedDemo';
import { useAuth } from '../auth/AuthContext';
import { conjuntoLocal } from '../data/conjuntoLocal';
import { criarConjuntoRemoto } from '../data/conjuntoRemoto';
import { useRecurso } from '../data/useRecurso';
import type { ConjuntoRepositorios, DiaBruto, EstadoEmpresa } from '../data/tipos';
import type { WorkspaceConfig, Pendencia } from '../domain';
import type { AuditEntry } from '../repositories/AuditRepository';
import { ErroApi } from '../api/client';

/* Dono de "qual empresa estou vendo agora" e de TODO o dado dela.
 *
 * A MUDANÇA CENTRAL DA FASE 4 está aqui, e é o que permitiu ligar a interface ao servidor sem
 * reescrever as treze telas:
 *
 *   - O CARREGAMENTO virou assíncrono e acontece uma vez, neste provedor.
 *   - A LEITURA continua síncrona para quem está dentro do sistema: as telas recebem
 *     `workspace`, `dias`, `pendencias` e `auditoria` prontos, exatamente como recebiam quando
 *     tudo vinha do `localStorage`.
 *
 * Sem essa separação, cada uma das treze telas teria que ganhar estado de carregamento, de erro e
 * de recarga — trezentas linhas de mudança em código que já funcionava e já era testado.
 *
 * DOIS CAMINHOS, UMA INTERFACE:
 *   demonstração → `conjuntoLocal`  (navegador, sem servidor, sem conta)
 *   empresa real → `conjuntoRemoto` (API, banco, tenant, sessão)
 * A escolha acontece uma vez, aqui. Nenhuma tela pergunta em qual modo está. */

export interface EmpresaDisponivel {
  id: string;
  nome: string;
  environment: 'real' | 'demo';
  papel: string;
  /* 'suspensa' = acesso bloqueado, dados preservados (programa piloto). */
  status?: 'ativa' | 'suspensa';
}

interface SessaoContextValue {
  /** null = ainda não escolheu empresa (mostra o portão de entrada). */
  workspace: WorkspaceConfig | null;
  workspaceIdAtivo: string | null;

  /** Empresas em que se pode entrar: as do servidor + a demonstração local. */
  empresas: EmpresaDisponivel[];

  /* ---- dado operacional, já carregado ---- */
  dias: DiaBruto[];
  pendencias: Pendencia[];
  auditoria: AuditEntry[];

  /* ---- estado do carregamento ---- */
  carregando: boolean;
  erroCarregamento: ErroApi | null;
  recarregar: () => Promise<void>;

  /* ---- modo e permissões ---- */
  modo: 'local' | 'remoto';
  papel: string;
  permissoes: string[];
  pode: (permissao: string) => boolean;
  /** Carimbo de concorrência do cadastro; enviado em toda gravação. */
  versao: string;

  /* ---- navegação entre empresas ---- */
  setWorkspaceAtivo: (id: string) => void;
  sairDoWorkspace: () => void;

  /* ---- gravação (todas assíncronas, todas passando pelo conjunto ativo) ---- */
  repositorios: ConjuntoRepositorios;
  /** Executa uma gravação e recarrega o estado da empresa em seguida. */
  gravar: <T>(acao: (r: ConjuntoRepositorios, ctx: { empresaId: string; versao: string }) => Promise<T>) => Promise<T>;

  /** true quando a empresa ativa foi criada nesta sessão — abre o onboarding. */
  recemCriada: boolean;
  marcarRecemCriada: (id: string) => void;
  marcarOnboardingVisto: () => void;
}

const SessaoContext = createContext<SessaoContextValue | null>(null);

const CHAVE_ATIVA = 'jornada360:activeWorkspaceId';
export const ID_DEMO = 'demo';

const ESTADO_VAZIO: Omit<EstadoEmpresa, 'config'> = {
  dias: [],
  pendencias: [],
  auditoria: [],
  versao: '',
  permissoes: [],
  papel: '',
};

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { estado: estadoSessao, tenants } = useAuth();

  const [workspaceIdAtivo, setIdAtivo] = useState<string | null>(() => localStorage.getItem(CHAVE_ATIVA));
  const [recemCriadaId, setRecemCriadaId] = useState<string | null>(null);

  /* O ambiente de demonstração é garantido na abertura para que "Ver demonstração" já encontre
   * dados prontos. O seed tem trava própria: só age em workspace de ambiente 'demo'. */
  useEffect(() => {
    WorkspaceRepository.ensureBootstrap();
    seedDemoWorkspaceIfEmpty();
  }, []);

  const ehDemo = workspaceIdAtivo === ID_DEMO;

  /* Uma instância só do conjunto remoto para toda a aplicação — recriá-lo a cada render
   * invalidaria as dependências do carregamento e recarregaria em laço. */
  const remoto = useRef<ConjuntoRepositorios | null>(null);
  if (!remoto.current) remoto.current = criarConjuntoRemoto();

  const repositorios = ehDemo ? conjuntoLocal : remoto.current;

  /* A empresa ativa precisa continuar existindo e continuar acessível. Duas situações reais:
   * alguém saiu da conta (o id salvo aponta para uma empresa que não é mais dele) e alguém teve o
   * acesso removido por um administrador. Nos dois casos o certo é voltar ao portão, não tentar
   * carregar e receber 404. */
  useEffect(() => {
    if (!workspaceIdAtivo || ehDemo) return;
    if (estadoSessao === 'verificando') return;
    // Se o usuário deslogou, limpa a empresa ativa imediatamente
    if (estadoSessao === 'anonimo') {
      localStorage.removeItem(CHAVE_ATIVA);
      setIdAtivo(null);
      return;
    }
    // NUNCA limpa empresa recém-criada (evita race condition enquanto o índice propaga)
    if (recemCriadaId === workspaceIdAtivo) return;
    // Só limpa se a lista de tenants já chegou e o id não pertence ao usuário
    if (tenants.length > 0 && !tenants.some((t) => t.id === workspaceIdAtivo)) {
      localStorage.removeItem(CHAVE_ATIVA);
      setIdAtivo(null);
    }
  }, [workspaceIdAtivo, ehDemo, estadoSessao, tenants, recemCriadaId]);

  const podeCarregar =
    !!workspaceIdAtivo && (
      ehDemo ||
      recemCriadaId === workspaceIdAtivo ||
      (estadoSessao === 'autenticado' && (tenants.length === 0 || tenants.some((t) => t.id === workspaceIdAtivo)))
    );

  const recurso = useRecurso<EstadoEmpresa>(
    () => repositorios.carregarTudo(workspaceIdAtivo as string),
    [workspaceIdAtivo, repositorios.modo],
    { habilitado: podeCarregar },
  );

  const setWorkspaceAtivo = useCallback((id: string) => {
    localStorage.setItem(CHAVE_ATIVA, id);
    setIdAtivo(id);
  }, []);

  const sairDoWorkspace = useCallback(() => {
    localStorage.removeItem(CHAVE_ATIVA);
    setIdAtivo(null);
    setRecemCriadaId(null);
  }, []);

  const marcarRecemCriada = useCallback((id: string) => setRecemCriadaId(id), []);
  const marcarOnboardingVisto = useCallback(() => setRecemCriadaId(null), []);

  const recarregar = recurso.recarregar;

  /* Toda gravação passa por aqui: executa contra o conjunto ativo, com o carimbo de versão
   * corrente, e relê o estado depois. Reler é a escolha conservadora — o servidor pode ter
   * derivado algo (ordenação, campos calculados, auditoria) que uma atualização otimista local
   * não reproduziria fielmente. */
  const gravar = useCallback(
    async <T,>(acao: (r: ConjuntoRepositorios, ctx: { empresaId: string; versao: string }) => Promise<T>): Promise<T> => {
      if (!workspaceIdAtivo) throw new ErroApi('validacao', 'Nenhuma empresa ativa.');
      const r = await acao(repositorios, { empresaId: workspaceIdAtivo, versao: recurso.dados?.versao ?? '' });
      await recarregar();
      return r;
    },
    [workspaceIdAtivo, repositorios, recurso.dados?.versao, recarregar],
  );

  /* Lista de onde se pode entrar. As empresas reais vêm do SERVIDOR (memberships da sessão) — o
   * frontend nunca monta essa lista sozinho, senão bastaria adivinhar um id para tentar entrar.
   * A demonstração é acrescentada localmente porque ela não é de ninguém. */
  const empresas = useMemo<EmpresaDisponivel[]>(() => {
    const reais = tenants.map((t) => ({ id: t.id, nome: t.nome, environment: t.environment, papel: t.papel, status: t.status }));
    return [...reais, { id: ID_DEMO, nome: 'Jornada360 Demo', environment: 'demo' as const, papel: 'administrador' }];
  }, [tenants]);

  const dados = recurso.dados;
  const permissoes = dados?.permissoes ?? ESTADO_VAZIO.permissoes;

  /* No modo local não há sessão nem papel; quem apresenta precisa ver tudo. No modo remoto, esta
   * função só ESCONDE o que não faz sentido oferecer — quem autoriza de verdade é o servidor, que
   * verifica de novo em cada rota. */
  const pode = useCallback(
    (permissao: string) => (repositorios.modo === 'local' ? true : permissoes.includes(permissao)),
    [repositorios.modo, permissoes],
  );

  const value = useMemo<SessaoContextValue>(
    () => ({
      workspace: dados?.config ?? null,
      workspaceIdAtivo: dados ? workspaceIdAtivo : null,
      empresas,
      dias: dados?.dias ?? ESTADO_VAZIO.dias,
      pendencias: dados?.pendencias ?? ESTADO_VAZIO.pendencias,
      auditoria: dados?.auditoria ?? ESTADO_VAZIO.auditoria,
      carregando: recurso.estado === 'carregando',
      erroCarregamento: recurso.erro,
      recarregar,
      modo: repositorios.modo,
      papel: dados?.papel ?? '',
      permissoes,
      pode,
      versao: dados?.versao ?? '',
      setWorkspaceAtivo,
      sairDoWorkspace,
      repositorios,
      gravar,
      recemCriada: !!workspaceIdAtivo && recemCriadaId === workspaceIdAtivo,
      marcarRecemCriada,
      marcarOnboardingVisto,
    }),
    [
      dados, workspaceIdAtivo, empresas, recurso.estado, recurso.erro, recarregar, repositorios,
      permissoes, pode, setWorkspaceAtivo, sairDoWorkspace, gravar, recemCriadaId,
      marcarRecemCriada, marcarOnboardingVisto,
    ],
  );

  return <SessaoContext.Provider value={value}>{children}</SessaoContext.Provider>;
}

/* Nível sessão — a empresa ativa pode ser null. Usado pelo roteador e pelo portão de entrada. */
export function useSessao(): SessaoContextValue {
  const ctx = useContext(SessaoContext);
  if (!ctx) throw new Error('useSessao deve ser usado dentro de WorkspaceProvider');
  return ctx;
}

/* Nível empresa — garante `workspace` e `workspaceIdAtivo` não nulos.
 *
 * Só pode ser chamado por componentes renderizados DENTRO do shell da aplicação, que o roteador só
 * monta quando o carregamento terminou. É essa garantia que permitiu as treze telas continuarem
 * lendo dado de forma síncrona depois da migração para o servidor. */
export function useWorkspace(): Omit<SessaoContextValue, 'workspace' | 'workspaceIdAtivo'> & {
  workspace: WorkspaceConfig;
  workspaceIdAtivo: string;
} {
  const ctx = useSessao();
  if (!ctx.workspace || !ctx.workspaceIdAtivo) {
    throw new Error('useWorkspace exige uma empresa ativa — use useSessao() fora do shell da aplicação');
  }
  return { ...ctx, workspace: ctx.workspace, workspaceIdAtivo: ctx.workspaceIdAtivo };
}
