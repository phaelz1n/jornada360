// ============================================================
// Ponto Icarus API Types
// ============================================================

export interface IcarusConfig {
  apiToken: string;
  baseUrl: string;
  empresaId?: string;
  autoSync?: boolean;
}

export interface IcarusColaborador {
  id: string;
  nome: string;
  cpf?: string;
  pis?: string;
  matricula?: string;
  cargo?: string;
  departamento?: string;
}

export interface IcarusBatida {
  id: string;
  colaboradorId: string;
  colaboradorNome: string;
  data: string;
  hora: string;
  tipo: 'entrada' | 'saida' | 'intervalo_saida' | 'intervalo_retorno' | 'desconhecido';
  origem?: string;
  equipamento?: string;
}

export interface IcarusJustificativaPayload {
  colaboradorId?: string;
  colaboradorNome: string;
  data: string;
  tipoHE?: 'HE1' | 'HE2' | 'HE3';
  motivo?: string;
  justificativa: string;
  usuarioResponsavel: string;
}

export interface IcarusApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  statusCode?: number;
}
