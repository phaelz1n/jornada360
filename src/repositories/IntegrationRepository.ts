import { WorkspaceRepository } from './WorkspaceRepository';
import type { IntegrationConfig } from '../domain';

/* Integrações configuradas por workspace (Cobli, sistema de ponto, importação de arquivo, API
 * genérica). Ver src/integrations/ para os adapters que consomem essa configuração — hoje só
 * "Importação Excel/CSV" tem implementação real; os demais ficam "não configurado" até a empresa-
 * -cliente ter credenciais/API pra usar (nunca armazenadas em código, ver INTEGRATIONS.md). */
export const IntegrationRepository = {
  list(workspaceId: string): IntegrationConfig[] {
    return WorkspaceRepository.getById(workspaceId)?.integrations ?? [];
  },

  update(workspaceId: string, integration: IntegrationConfig): void {
    const atuais = this.list(workspaceId);
    const idx = atuais.findIndex((i) => i.id === integration.id);
    const novas = [...atuais];
    if (idx >= 0) novas[idx] = integration;
    else novas.push(integration);
    WorkspaceRepository.updateIntegrations(workspaceId, novas);
  },
};
