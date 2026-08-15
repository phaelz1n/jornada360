/* Contrato preparado para a Fase 2 (score multidimensional com evolução histórica). Hoje o score
 * é calculado ao vivo por src/services/scoreService.ts a partir de TimeRecordRepository — nada é
 * "congelado" por período ainda. Este repositório existe para já ter onde guardar snapshots de
 * score por colaborador/período quando isso for implementado, sem redesenhar a camada de dados. */
import { APP_PREFIX, readJSON, writeJSON } from './localStorageClient';

export interface ScoreSnapshot {
  colaborador: string;
  periodo: string;
  score: number;
  registradoEm: string;
}

function key(workspaceId: string): string {
  return `${APP_PREFIX}${workspaceId}:scoreHistory`;
}

export const ScoreRepository = {
  history(workspaceId: string): ScoreSnapshot[] {
    return readJSON<ScoreSnapshot[]>(key(workspaceId), []);
  },

  registrar(workspaceId: string, snapshot: Omit<ScoreSnapshot, 'registradoEm'>): void {
    const atuais = this.history(workspaceId);
    writeJSON(key(workspaceId), [{ ...snapshot, registradoEm: new Date().toISOString() }, ...atuais]);
  },
};
