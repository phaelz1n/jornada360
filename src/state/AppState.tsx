import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import type { AuditEntry } from '../repositories/AuditRepository';
import { useSessao } from '../workspace/WorkspaceContext';
import { useAuth } from '../auth/AuthContext';

export type AuditLogEntry = AuditEntry;

interface AppStateShape {
  auditLog: AuditLogEntry[];
  registrarAuditoria: (entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) => void;
  /** Nome de quem está operando. Vem da SESSÃO no modo conectado. */
  usuarioAtual: string;
}

const AppStateContext = createContext<AppStateShape | null>(null);

/* Trilha de auditoria exposta à interface.
 *
 * MUDANÇA DA FASE 4 — a mais importante deste arquivo: no modo conectado, o frontend deixou de ser
 * a autoridade sobre "quem fez". A trilha vem do servidor, e cada registro tem como autor o usuário
 * da SESSÃO, resolvido no backend dentro da própria rota que alterou o dado. O cliente não escreve
 * na trilha e não escolhe o autor — era exatamente essa possibilidade que tornava a auditoria local
 * indefensável.
 *
 * `registrarAuditoria` continua existindo porque a demonstração ainda registra localmente. No modo
 * conectado ele é um caminho sem efeito, de propósito: as rotas já gravaram o que precisava ser
 * gravado, e deixar o cliente acrescentar entradas abriria a porta para registrar uma ação em nome
 * de outra pessoa.
 *
 * Usa `useSessao` (não `useWorkspace`) porque envolve TODA a árvore, inclusive o portão de entrada,
 * onde ainda não há empresa ativa. */
export function AppStateProvider({ children }: { children: ReactNode }) {
  const { auditoria, modo, workspaceIdAtivo, repositorios, recarregar } = useSessao();
  const { usuario } = useAuth();

  /* No modo conectado o nome vem da sessão. Na demonstração não há conta — e rotular como
   * "Demonstração" é mais honesto do que inventar o nome de uma pessoa que não existe. */
  const usuarioAtual = modo === 'remoto' ? (usuario?.nome ?? 'Sessão encerrada') : 'Demonstração';

  const registrarAuditoria = useCallback(
    (entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) => {
      if (!workspaceIdAtivo) return;
      /* No modo remoto isto não faz nada (ver conjuntoRemoto.registrarAuditoria) — a rota que
       * alterou o dado já registrou, com o autor correto. */
      void repositorios
        .registrarAuditoria(workspaceIdAtivo, { ...entry, usuario: entry.usuario || usuarioAtual })
        .then(() => {
          if (modo === 'local') void recarregar();
        })
        .catch(() => {
          /* Falha ao registrar auditoria não pode derrubar a ação que a pessoa acabou de concluir.
           * No modo remoto a trilha confiável é a do servidor, que já foi gravada na própria rota. */
        });
    },
    [workspaceIdAtivo, repositorios, usuarioAtual, modo, recarregar],
  );

  const value = useMemo(
    () => ({ auditLog: auditoria, registrarAuditoria, usuarioAtual }),
    [auditoria, registrarAuditoria, usuarioAtual],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState deve ser usado dentro de AppStateProvider');
  return ctx;
}
