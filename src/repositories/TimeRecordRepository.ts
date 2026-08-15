/* Acesso a dados de ponto/jornada por dia processado. Hoje é um envelope fino sobre
 * src/engine/heEngineBridge.ts (que fala o mesmo formato de storage que o motor real do
 * Assistente HE Diário usa) — não duplica nem reimplementa o cruzamento de planilhas, só dá um
 * contrato estável (`TimeRecordRepository`) pra camada de serviços/interface consumir, em vez de
 * chamar o bridge diretamente. Trocar a fonte de dados no futuro (API/backend) significa reescrever
 * só este arquivo. */
import {
  limparTodosOsDiasProcessados,
  listProcessedDateKeys,
  loadCaseState,
  loadSnapshot,
  saveSnapshot,
  updateCaseField,
} from '../engine/heEngineBridge';
import type { HECaseState, HEDiaSnapshot } from '../engine/heEngineCore';

export const TimeRecordRepository = {
  listDateKeys(workspaceId: string): string[] {
    return listProcessedDateKeys(workspaceId);
  },

  getSnapshot(workspaceId: string, dateKey: string): HEDiaSnapshot | null {
    return loadSnapshot(workspaceId, dateKey);
  },

  saveSnapshot(workspaceId: string, snapshot: HEDiaSnapshot): void {
    saveSnapshot(workspaceId, snapshot);
  },

  getCaseState(workspaceId: string, dateKey: string): Record<string, HECaseState> {
    return loadCaseState(workspaceId, dateKey);
  },

  updateCase(workspaceId: string, dateKey: string, colaborador: string, patch: Partial<HECaseState>) {
    return updateCaseField(workspaceId, dateKey, colaborador, patch);
  },

  clearAll(workspaceId: string): number {
    return limparTodosOsDiasProcessados(workspaceId);
  },
};
