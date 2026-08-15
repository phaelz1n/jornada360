/* Camada de integração — o Jornada360 não deve depender de um fornecedor específico de
 * rastreamento/ponto. Cada fonte externa (Cobli, sistema de ponto, importação de arquivo, API
 * genérica) implementa este mesmo contrato como um "adapter". Trocar de empresa-cliente que usa
 * outro fornecedor de rastreamento = escrever um novo adapter, sem tocar no resto do sistema.
 *
 * Nesta fase só o adapter de importação de arquivo (FileImportIntegration) tem corpo real — os
 * demais existem como contrato/stub, prontos para receber uma implementação quando a integração
 * de verdade for contratada. Nenhuma credencial/token/senha é armazenada em código — ver
 * INTEGRATIONS.md para o padrão de configuração (variáveis de ambiente / config administrativa). */

export interface ImportResultado {
  registrosEncontrados: number;
  registrosValidos: number;
  registrosComErro: number;
  erros: string[];
}

export interface IntegrationAdapter {
  tipo: 'cobli' | 'ponto' | 'excel_csv' | 'api';
  nome: string;
  /** true = funciona hoje sem depender de credencial externa ainda não configurada. */
  disponivel: boolean;
  importar(input: unknown): Promise<ImportResultado>;
}

export const IntegrationService = {
  registrar(adapters: IntegrationAdapter[]): Map<string, IntegrationAdapter> {
    return new Map(adapters.map((a) => [a.tipo, a]));
  },
};
