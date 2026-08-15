/* Duas responsabilidades neste arquivo, deliberadamente no mesmo repositório (ambas são "acesso a
 * dados de pendência"), mas sobre storages diferentes — não confundir uma com a outra:
 *
 * 1. EDIÇÃO DO CASO BRUTO DO MOTOR (`updateCampo`/`resolve`) — grava em HECaseState, o mesmo
 *    storage que o iframe do Assistente HE Diário usa (via TimeRecordRepository/heEngineBridge).
 *    Chamado por src/engine/useHEEngineData.ts (marcarCampo) — é o único caminho pelo qual setor/
 *    causa/justificativa/done são editados na interface.
 *
 * 2. ENTIDADE PENDENCIA PERSISTIDA (`criarPendencia`/`buscarPendencia`/`listarPorWorkspace`/
 *    `atualizarPendencia`/`resolverPendencia`) — Fase 2, Etapa 2. Storage próprio
 *    (`jornada360:{workspaceId}:pendencias`, via localStorageClient — nunca `assistente_he_local_`).
 *    É a "unidade de trabalho rastreável" pedida no ROADMAP ("Pendência como entidade própria"):
 *    sobrevive independente do HECaseState, tem id estável entre reprocessamentos. Chamado por
 *    src/services/pendenciaService.ts, que é quem decide QUANDO materializar/atualizar uma
 *    Pendencia a partir do caso do motor — este repositório só persiste o que o service manda,
 *    não decide nada sozinho. */
import { TimeRecordRepository } from './TimeRecordRepository';
import { APP_PREFIX, readJSON, removeKey, writeJSON } from './localStorageClient';
import type { HECaseState } from '../engine/heEngineCore';
import type { Pendencia, StatusPendencia } from '../domain/Pendencia';

function pendenciasKey(workspaceId: string): string {
  return `${APP_PREFIX}${workspaceId}:pendencias`;
}

export const PendingRepository = {
  updateCampo(workspaceId: string, dateKey: string, colaborador: string, patch: Partial<HECaseState>) {
    return TimeRecordRepository.updateCase(workspaceId, dateKey, colaborador, patch);
  },

  resolve(workspaceId: string, dateKey: string, colaborador: string, motivo?: string) {
    return this.updateCampo(workspaceId, dateKey, colaborador, {
      done: true,
      ...(motivo ? { justificativa: motivo } : {}),
    });
  },

  listarPorWorkspace(workspaceId: string): Pendencia[] {
    return readJSON<Pendencia[]>(pendenciasKey(workspaceId), []);
  },

  buscarPendencia(workspaceId: string, id: string): Pendencia | null {
    return this.listarPorWorkspace(workspaceId).find((p) => p.id === id) ?? null;
  },

  /* Apaga todas as pendências persistidas do workspace. Usado só ao excluir a empresa inteira
   * (ver workspaceService.excluirWorkspace) — não há caminho na interface para limpar pendências
   * de uma empresa que continua existindo. Remove a chave em vez de gravar uma lista vazia: a
   * empresa deixou de existir, então nem o registro vazio dela deve sobrar no storage. */
  limparPendencias(workspaceId: string): void {
    removeKey(pendenciasKey(workspaceId));
  },

  criarPendencia(workspaceId: string, pendencia: Pendencia): Pendencia {
    const all = this.listarPorWorkspace(workspaceId);
    const idx = all.findIndex((p) => p.id === pendencia.id);
    if (idx >= 0) all[idx] = pendencia;
    else all.push(pendencia);
    writeJSON(pendenciasKey(workspaceId), all);
    return pendencia;
  },

  atualizarPendencia(workspaceId: string, id: string, patch: Partial<Pendencia>): Pendencia | null {
    const all = this.listarPorWorkspace(workspaceId);
    const idx = all.findIndex((p) => p.id === id);
    if (idx < 0) return null;
    const atualizada: Pendencia = { ...all[idx], ...patch, atualizadaEm: new Date().toISOString() };
    all[idx] = atualizada;
    writeJSON(pendenciasKey(workspaceId), all);
    return atualizada;
  },

  /* Transição pra um status "resolvido" (hoje só 'justificado' é alcançável — ver
   * pendingClassificationService.ts). Preserva `resolvidaEm` se a pendência já estava resolvida
   * antes (não reinicia o relógio a cada sincronização), mas sempre atualiza `resolucao` (o texto
   * pode mudar depois de resolvido, ex.: justificativa editada). */
  resolverPendencia(workspaceId: string, id: string, status: StatusPendencia, resolucao: string | null): Pendencia | null {
    const all = this.listarPorWorkspace(workspaceId);
    const idx = all.findIndex((p) => p.id === id);
    if (idx < 0) return null;
    const atual = all[idx];
    const resolvida: Pendencia = {
      ...atual,
      status,
      resolucao,
      resolvidaEm: atual.resolvidaEm ?? new Date().toISOString(),
      atualizadaEm: new Date().toISOString(),
    };
    all[idx] = resolvida;
    writeJSON(pendenciasKey(workspaceId), all);
    return resolvida;
  },

  /* Revisão humana (Fase 2, Etapa 8) — transição pra 'aprovado'/'reprovado', com quem/quando/porquê.
   * Não mexe em `resolvidaEm`/`resolucao` (isso continua descrevendo a resolução original;
   * revisão é uma decisão posterior e diferente — ver BUSINESS_RULES.md). */
  revisarPendencia(
    workspaceId: string,
    id: string,
    decisao: Extract<StatusPendencia, 'aprovado' | 'reprovado'>,
    revisadoPor: string,
    observacao: string | null,
  ): Pendencia | null {
    return this.atualizarPendencia(workspaceId, id, {
      status: decisao,
      revisadoPor,
      revisadoEm: new Date().toISOString(),
      observacaoRevisao: observacao,
    });
  },

  /* "excluir" não foi implementado nesta etapa — nenhuma tela tem uma ação que precise apagar uma
   * Pendencia (ver instrução: "eventualmente excluir somente se houver necessidade real"). Se
   * surgir necessidade real (ex.: reprocessar um dia do zero), adicionar aqui. */
};
