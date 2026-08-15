import type { IntegrationAdapter } from '../IntegrationService';

/* Stub — implementação real depende de credenciais de API da conta Cobli da empresa-cliente
 * (nunca armazenadas em código; ver INTEGRATIONS.md). Hoje o cruzamento com dados Cobli é feito
 * via importação de arquivo exportado manualmente (Assistente HE Diário). Esse adapter é o ponto
 * de extensão para quando existir acesso direto à API. */
export const CobliIntegration: IntegrationAdapter = {
  tipo: 'cobli',
  nome: 'Cobli (rastreamento)',
  disponivel: false,
  async importar(): Promise<never> {
    throw new Error('Integração Cobli via API ainda não configurada para este workspace.');
  },
};
