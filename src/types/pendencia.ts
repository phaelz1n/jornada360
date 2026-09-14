// ============================================================
// Pendencia / SLA Types
// ============================================================

export type PendenciaStatus =
  | 'nova'
  | 'em_analise'
  | 'aguardando_gestor'
  | 'aguardando_rh'
  | 'resolvida'
  | 'descartada';

export type Prioridade = 'baixa' | 'media' | 'alta' | 'critica';

export type PendenciaTipo =
  | 'excedente'
  | 'divergencia'
  | 'interjornada'
  | 'intrajornada'
  | 'sem_ponto'
  | 'sem_rastreio';

export interface StatusChange {
  de: PendenciaStatus;
  para: PendenciaStatus;
  usuario: string;
  timestamp: Date;
  observacao?: string;
}

export interface Pendencia {
  id: string;
  workspaceId: string;
  auditItemId: string;
  motorista: string;
  data: string;
  tipo: PendenciaTipo;
  descricao: string;
  prioridade: Prioridade;
  status: PendenciaStatus;
  responsavel?: string;
  slaVencimento?: Date;
  resolucao?: string;
  historicoStatus: StatusChange[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PendenciaFilters {
  status?: PendenciaStatus[];
  prioridade?: Prioridade[];
  tipo?: PendenciaTipo[];
  motorista?: string;
  dataInicio?: string;
  dataFim?: string;
}
