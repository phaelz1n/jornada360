import { APP_PREFIX, readJSON, removeKey, writeJSON } from './localStorageClient';

export interface AuditEntry {
  id: string;
  timestamp: string;
  usuario: string;
  entidade: string;
  acao: string;
  valorAnterior: string;
  valorNovo: string;
  motivo: string;
}

function key(workspaceId: string): string {
  return `${APP_PREFIX}${workspaceId}:auditLog`;
}

/* Trilha de auditoria persistida por workspace (antes vivia só em memória, no React state, e se
 * perdia a cada reload). "Quem alterou o quê, quando, valor anterior/novo, motivo" — a base
 * pedida no item 11 (auditoria) e 14 (segurança/rastreabilidade) do briefing. */
export const AuditRepository = {
  list(workspaceId: string): AuditEntry[] {
    return readJSON<AuditEntry[]>(key(workspaceId), []);
  },

  add(workspaceId: string, entry: Omit<AuditEntry, 'id' | 'timestamp'>): AuditEntry {
    const all = this.list(workspaceId);
    const novo: AuditEntry = {
      ...entry,
      id: `aud-${Date.now()}-${all.length}`,
      timestamp: new Date().toLocaleString('pt-BR'),
    };
    writeJSON(key(workspaceId), [novo, ...all]);
    return novo;
  },

  /* Remove a chave inteira, não grava uma lista vazia — só é chamado ao excluir a empresa
   * (workspaceService.excluirWorkspace), então nada dela deve sobrar no storage. Não existe, de
   * propósito, nenhum caminho na interface para limpar a auditoria de uma empresa que continua
   * existindo: apagar a trilha de uma operação viva anularia o objetivo dela. */
  clear(workspaceId: string): void {
    removeKey(key(workspaceId));
  },
};
