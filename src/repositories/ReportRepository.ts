/* Contrato preparado para a Fase 3 (relatórios exportáveis/gerados e salvos). Hoje os relatórios
 * do Jornada360 são todos calculados ao vivo a partir de TimeRecordRepository (ver
 * src/engine/heAggregations.ts) — nada é "gerado e guardado" ainda. Este repositório existe para
 * já ter o ponto de extensão pronto quando isso for implementado (ex.: histórico de relatórios
 * mensais exportados em PDF/Excel), sem precisar redesenhar a camada de dados depois. */
import { APP_PREFIX, readJSON, writeJSON } from './localStorageClient';

export interface GeneratedReport {
  id: string;
  tipo: 'diario' | 'horas_extras' | 'divergencias' | 'reincidencia' | 'gerencial';
  periodo: string;
  geradoEm: string;
}

function key(workspaceId: string): string {
  return `${APP_PREFIX}${workspaceId}:reports`;
}

export const ReportRepository = {
  list(workspaceId: string): GeneratedReport[] {
    return readJSON<GeneratedReport[]>(key(workspaceId), []);
  },

  register(workspaceId: string, report: Omit<GeneratedReport, 'id' | 'geradoEm'>): GeneratedReport {
    const atuais = this.list(workspaceId);
    const novo: GeneratedReport = { ...report, id: `rep-${Date.now()}`, geradoEm: new Date().toISOString() };
    writeJSON(key(workspaceId), [novo, ...atuais]);
    return novo;
  },
};
