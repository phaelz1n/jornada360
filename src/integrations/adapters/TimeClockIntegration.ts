import type { IntegrationAdapter } from '../IntegrationService';

/* Stub — sistema de ponto varia por empresa-cliente (nem todo fornecedor tem API/exportação
 * estruturada). Hoje o Assistente HE Diário lê o espelho de ponto exportado em planilha
 * (FileImportIntegration cobre esse caso). Este adapter é o ponto de extensão para quando um
 * fornecedor específico oferecer integração direta. */
export const TimeClockIntegration: IntegrationAdapter = {
  tipo: 'ponto',
  nome: 'Sistema de ponto (API/exportação)',
  disponivel: false,
  async importar(): Promise<never> {
    throw new Error('Integração direta com sistema de ponto ainda não configurada para este workspace.');
  },
};
