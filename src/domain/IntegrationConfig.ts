export type IntegrationType = 'cobli' | 'ponto' | 'excel_csv' | 'api';
export type IntegrationStatus = 'nao_configurado' | 'configurado';

export interface IntegrationConfig {
  id: string;
  tipo: IntegrationType;
  nome: string;
  status: IntegrationStatus;
}

export function integracoesPadrao(): IntegrationConfig[] {
  return [
    { id: 'excel_csv', tipo: 'excel_csv', nome: 'Importação Excel/CSV', status: 'configurado' },
    { id: 'cobli', tipo: 'cobli', nome: 'Cobli (rastreamento)', status: 'nao_configurado' },
    { id: 'ponto', tipo: 'ponto', nome: 'Sistema de ponto (API/exportação)', status: 'nao_configurado' },
    { id: 'api', tipo: 'api', nome: 'API genérica', status: 'nao_configurado' },
  ];
}
