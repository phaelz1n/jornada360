import type { IntegrationAdapter } from '../IntegrationService';

/* Stub genérico — quando o Jornada360 ganhar backend próprio, este é o adapter que passa a
 * chamar a API real (ver ARCHITECTURE.md). Nesta fase só documenta o ponto de extensão. */
export const ApiIntegration: IntegrationAdapter = {
  tipo: 'api',
  nome: 'API genérica',
  disponivel: false,
  async importar(): Promise<never> {
    throw new Error('Nenhuma API configurada para este workspace.');
  },
};
