/* Tipos e interfaces analíticas do Jornada360 (Camada Gold).
 *
 * Princípio: estruturas de dados puras e imutáveis para representação de métricas,
 * agregações executivas, rankings e séries temporais.
 */
import type { HEItemComputed } from '../engine/useHEEngineData';
import type { RegistroReal } from '../engine/heAggregations';
import type { StatusPendencia } from '../domain/Pendencia';

export interface IndicadorExplicado {
  chave: string;
  label: string;
  /** null = não há dado suficiente para calcular. A tela mostra "—", nunca 0 como se fosse medido. */
  valor: number | null;
  formato: 'inteiro' | 'percentual' | 'minutos';
  comoFoiCalculado: string;
  porqueAparece: string;
  disponivel: boolean;
  motivoIndisponivel?: string;
}

export interface LinhaRanking {
  chave: string;
  label: string;
  sublabel: string;
  valor: number;
  valorSecundario: number;
}

export interface PontoTemporal {
  chave: string;
  label: string;
  heTotalMin: number;
  divergencias: number;
  registros: number;
  conformidadePct: number;
}

export interface ContagemRotulada {
  label: string;
  valor: number;
  pct: number;
}

export interface RegistroAnalisado {
  dateKey: string;
  dateLabel: string;
  item: HEItemComputed;
  status: StatusPendencia;
  temAlertaJornada: boolean;
}

export interface VisaoGeral {
  diasProcessados: number;
  registrosAnalisados: number;
  colaboradoresDistintos: number;
  primeiroDia: string | null;
  ultimoDia: string | null;
  indicadores: IndicadorExplicado[];
}

export interface IndicadorColaborador {
  chave: string;
  nome: string;
  setorMaisComum: string;
  diasAnalisados: number;
  diasAcimaPadrao: number;
  heTotalMin: number;
  excedenteTotalMin: number;
  conformidadePct: number;
  reincidenteCritico: boolean;
  alertasJornada: number;
}

export interface IndicadorSetor {
  setor: string;
  heTotalMin: number;
  casos: number;
  divergencias: number;
  registros: RegistroReal[];
  sintetico: boolean;
}

export interface IndicadorUnidade {
  unidadeId: string | null;
  unidade: string;
  colaboradores: number;
  registros: number;
  heTotalMin: number;
  excedenteTotalMin: number;
  divergencias: number;
  conformidadePct: number;
}

export interface IndicadoresPendencias {
  total: number;
  abertas: number;
  resolvidas: number;
  porStatus: ContagemRotulada[];
  porSla: ContagemRotulada[];
  aprovadas: number;
  reprovadas: number;
  aguardandoRevisao: number;
  vencidas: number;
  semPrazo: number;
  semResponsavel: number;
  aderenciaPrazoPct: number | null;
  taxaAprovacaoPct: number | null;
  tempoMedioResolucaoDias: number | null;
}

export type SeveridadeAtencao = 'alta' | 'media';

export interface PontoDeAtencao {
  chave: string;
  titulo: string;
  detalhe: string;
  severidade: SeveridadeAtencao;
  destino: string;
}
