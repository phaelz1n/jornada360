// ============================================================
// Workspace & Configuration Types
// ============================================================

export interface Workspace {
  id: string;
  nome: string;
  cnpj?: string;
  config: WorkspaceConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceConfig {
  /** Tolerância padrão de HE em minutos (default: 10) */
  toleranciaPadraoMin: number;
  /** Limite superior de divergência leve em minutos (default: 60) */
  toleranciaDivLeveMin: number;
  /** Mínimo de interjornada em minutos (default: 660 = 11h) */
  toleranciaInterjornadaMin: number;
  /** Meta diária de HE em minutos (default: 2170 = 36h10min) */
  metaDiariaHEMin: number;
  /** Ciclo de fechamento: dia de início e fim (ex: 28 a 27) */
  cicloFechamento: CicloFechamento;
  /** Threshold para fuzzy matching de nomes (default: 0.85) */
  fuzzyMatchThreshold: number;
  /** Aliases de causas: chave é o alias, valor é o nome canônico */
  aliasesCausas: Record<string, string>;
  /** Aliases de setores: chave é o alias, valor é o nome canônico */
  aliasesSetores: Record<string, string>;
  /** Configuração de intervalos obrigatórios */
  intervalos: IntervaloConfig;
}

export interface CicloFechamento {
  diaInicio: number;
  diaFim: number;
}

export interface IntervaloConfig {
  /** Duração mínima do 1º intervalo em minutos */
  primeiroMin: number;
  /** Duração mínima do 2º intervalo em minutos */
  segundoMin: number;
}

export function createDefaultConfig(): WorkspaceConfig {
  return {
    toleranciaPadraoMin: 10,
    toleranciaDivLeveMin: 60,
    toleranciaInterjornadaMin: 660,
    metaDiariaHEMin: 2170,
    cicloFechamento: { diaInicio: 28, diaFim: 27 },
    fuzzyMatchThreshold: 0.85,
    aliasesCausas: {},
    aliasesSetores: {},
    intervalos: { primeiroMin: 60, segundoMin: 15 },
  };
}
