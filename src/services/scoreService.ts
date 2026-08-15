/* Score do colaborador — multidimensional (Bloco Analítico).
 *
 * O score é a MÉDIA SIMPLES das dimensões que puderam ser medidas para aquele colaborador. Peso
 * igual é uma decisão explícita, não um descuido: qualquer outro conjunto de pesos seria um juízo
 * de valor que o negócio ainda não tomou ("faltar padrão cadastrado é duas vezes pior que furar o
 * descanso?" não tem resposta no sistema). Quando a empresa decidir esses pesos, eles viram
 * configuração em Rules — a estrutura abaixo já isola cada dimensão pra isso.
 *
 * Dimensão que não pôde ser medida (por falta de dado) NÃO entra como zero: sai da média e aparece
 * como "não avaliada". Zerar seria punir o colaborador por uma lacuna de cadastro.
 *
 * DIMENSÕES PEDIDAS QUE **NÃO** FORAM IMPLEMENTADAS (e por quê):
 * - Pontualidade: exigiria comparar a batida de entrada com o início do horário padrão. O motor tem
 *   os dois valores, mas só os expõe como TEXTO (`batidas`, `padraoHorarios`) — não há campo
 *   estruturado de atraso em minutos. Derivar isso por parsing de string seria frágil e inventaria
 *   precisão que o dado não tem. Fica registrado no ROADMAP como campo a produzir no motor.
 * - Magnitude da hora extra: o dado existe (excedente em minutos), mas não existe limiar configurado
 *   que diga quantos minutos são "muito" — a mesma limitação já documentada na priorização (Etapa 5).
 *   Sem esse número, qualquer escala seria arbitrária. */
import { agregarPorMotorista } from '../engine/heAggregations';
import { temAlertaDeJornada } from './journeyService';
import type { HEDiaComputed, HEItemComputed } from '../engine/useHEEngineData';

export type ChaveDimensao = 'conformidade' | 'registros_completos' | 'regularidade_jornada' | 'confirmacao_rastreio' | 'tratamento';

export interface DimensaoScore {
  chave: ChaveDimensao;
  label: string;
  /** null = não avaliada (sem base de cálculo para este colaborador). Não entra na média. */
  valor: number | null;
  /** Numerador/denominador reais, para a tela poder mostrar "8 de 10 dias". */
  base: string;
  comoFoiCalculado: string;
}

export interface ScoreColaborador {
  key: string;
  motorista: string;
  setorMaisComum: string;
  diasAnalisados: number;
  diasAcimaPadrao: number;
  /** Primeira dimensão, mantida no topo por ser a mais usada nas telas antigas. */
  conformidadePct: number;
  /** Média simples das dimensões avaliadas. null se nenhuma pôde ser avaliada. */
  scoreGeral: number | null;
  dimensoes: DimensaoScore[];
  reincidenteCritico: boolean;
}

export const DIMENSAO_LABEL: Record<ChaveDimensao, string> = {
  conformidade: 'Conformidade com o padrão',
  registros_completos: 'Registros completos',
  regularidade_jornada: 'Regularidade de jornada',
  confirmacao_rastreio: 'Confirmação por rastreio',
  tratamento: 'Tratamento das ocorrências',
};

function pctOuNull(parte: number, total: number): number | null {
  return total > 0 ? Math.round((parte / total) * 100) : null;
}

function construirDimensoes(itens: HEItemComputed[]): DimensaoScore[] {
  const total = itens.length;

  const comPadrao = itens.filter((i) => i._padraoStatus === 'acima' || i._padraoStatus === 'dentro');
  const dentroDoPadrao = comPadrao.filter((i) => i._padraoStatus === 'dentro').length;
  const semAlerta = itens.filter((i) => !temAlertaDeJornada(i)).length;

  /* Só faz sentido avaliar rastreio nos casos em que o rastreio foi consultado de verdade —
   * `sem_dado` significa que não havia rastreio pra comparar, não que o colaborador falhou. */
  const comRastreio = itens.filter((i) => i._status !== 'sem_dado');
  const rastreioConfirma = comRastreio.filter((i) => i._status === 'ok').length;

  /* Só conta quem gerou ocorrência: quem nunca ficou fora do padrão não tem o que tratar, e essa
   * dimensão sairia como "0 de 0" — vira "não avaliada" em vez de penalizar. */
  const ocorrencias = itens.filter((i) => i._padraoStatus !== 'dentro');
  const tratadas = ocorrencias.filter((i) => i._done).length;

  return [
    {
      chave: 'conformidade',
      label: DIMENSAO_LABEL.conformidade,
      valor: pctOuNull(dentroDoPadrao, comPadrao.length),
      base: `${dentroDoPadrao} de ${comPadrao.length} dia(s) com padrão cadastrado`,
      comoFoiCalculado:
        'Dias em que a hora extra ficou dentro da tolerância configurada, divididos pelos dias em que havia padrão cadastrado para comparar. Dias sem padrão não entram — não seria justo contá-los como falha do colaborador.',
    },
    {
      chave: 'registros_completos',
      label: DIMENSAO_LABEL.registros_completos,
      valor: pctOuNull(comPadrao.length, total),
      base: `${comPadrao.length} de ${total} dia(s) analisado(s)`,
      comoFoiCalculado:
        'Dias em que havia horário padrão cadastrado e legível, divididos pelo total de dias analisados. Mede a qualidade do cadastro deste colaborador em Configurações → Escalas.',
    },
    {
      chave: 'regularidade_jornada',
      label: DIMENSAO_LABEL.regularidade_jornada,
      valor: pctOuNull(semAlerta, total),
      base: `${semAlerta} de ${total} dia(s) sem alerta`,
      comoFoiCalculado:
        'Dias sem alerta de descanso entre jornadas nem de pausa dentro da jornada, comparados aos mínimos configurados em Configurações → Regras, divididos pelo total de dias.',
    },
    {
      chave: 'confirmacao_rastreio',
      label: DIMENSAO_LABEL.confirmacao_rastreio,
      valor: pctOuNull(rastreioConfirma, comRastreio.length),
      base: `${rastreioConfirma} de ${comRastreio.length} dia(s) com rastreio disponível`,
      comoFoiCalculado:
        'Dias em que o rastreio confirmou as batidas de ponto, divididos pelos dias em que havia rastreio para comparar. Dias sem rastreio ficam de fora do cálculo.',
    },
    {
      chave: 'tratamento',
      label: DIMENSAO_LABEL.tratamento,
      valor: pctOuNull(tratadas, ocorrencias.length),
      base: `${tratadas} de ${ocorrencias.length} ocorrência(s)`,
      comoFoiCalculado:
        'Ocorrências deste colaborador que já foram tratadas e marcadas como resolvidas, divididas pelo total de ocorrências dele. Mede o andamento do tratamento, não a conduta do colaborador.',
    },
  ];
}

export function calcularScores(dias: HEDiaComputed[], recurrenceLimit = Infinity): ScoreColaborador[] {
  const itensPorChave = new Map<string, HEItemComputed[]>();
  for (const dia of dias) {
    for (const item of dia.items) {
      const lista = itensPorChave.get(item._key) || [];
      lista.push(item);
      itensPorChave.set(item._key, lista);
    }
  }

  return agregarPorMotorista(dias).map((m) => {
    const dimensoes = construirDimensoes(itensPorChave.get(m.key) || []);
    const avaliadas = dimensoes.filter((d): d is DimensaoScore & { valor: number } => d.valor !== null);
    const scoreGeral = avaliadas.length
      ? Math.round(avaliadas.reduce((s, d) => s + d.valor, 0) / avaliadas.length)
      : null;

    return {
      key: m.key,
      motorista: m.motorista,
      setorMaisComum: m.setorMaisComum,
      diasAnalisados: m.diasAnalisados,
      diasAcimaPadrao: m.diasAcimaPadrao,
      conformidadePct: dimensoes.find((d) => d.chave === 'conformidade')?.valor ?? 100,
      scoreGeral,
      dimensoes,
      reincidenteCritico: m.diasAcimaPadrao > recurrenceLimit,
    };
  });
}
