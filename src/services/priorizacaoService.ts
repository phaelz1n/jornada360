/* Recomendação de prioridade (Fase 2, Etapa 5) — determinística, sem IA, sem peso arbitrário, sem
 * limiar inventado. Usa só dois sinais que já existem de forma confiável no sistema:
 *
 * 1. `status` da Pendencia (StatusPendencia, Etapa 1) — já reflete padrão × tolerância × rastreio,
 *    não recalculado aqui.
 * 2. Reincidência do colaborador (`diasAcimaPadrao`, de `heAggregations.agregarPorMotorista`) contra
 *    `workspace.rules.recurrenceLimit` — o MESMO parâmetro e a MESMA definição de "crítico" que
 *    `recurrenceService.calcularReincidencia` já usa no Ranking de Reincidência; nenhum limiar novo
 *    foi inventado, e o parâmetro já é configurável por workspace desde a Fase 1.
 *
 * Sinais avaliados e descartados nesta etapa (documentados em BUSINESS_RULES.md): magnitude do
 * excedente em minutos e idade da pendência — o dado existe, mas não há limiar configurado nas
 * regras de negócio que diga o que conta como "muito" ou "antigo". Inventar esse número aqui
 * violaria a instrução explícita de não inventar limiar — fica documentado como configuração futura.
 *
 * A recomendação NUNCA é persistida — é computada sob demanda a partir de dados já existentes, o
 * que garante por construção que "a mesma Pendência, com os mesmos dados, produz a mesma
 * recomendação" (determinismo/reprodutibilidade pedidos). `Pendencia.prioridade` continua sendo a
 * única prioridade efetiva; aplicar a recomendação é uma ação explícita do usuário (ver
 * RealPendenciasSection.tsx/CentroAcoes.tsx), nunca uma escrita automática. */
import type { HEDiaComputed, HEItemComputed } from '../engine/useHEEngineData';
import { agregarPorMotorista } from '../engine/heAggregations';
import { estadoResolvido } from './pendenciaService';
import type { Pendencia, Prioridade, StatusPendencia } from '../domain/Pendencia';
import { PRIORIDADE_LABEL, STATUS_PENDENCIA_LABEL } from '../domain/Pendencia';

export interface SinalPriorizacao {
  label: string;
  valor: string;
}

export interface RecomendacaoPrioridade {
  prioridade: Prioridade;
  motivo: string;
  sinais: SinalPriorizacao[];
}

const PROXIMO_NIVEL: Record<Prioridade, Prioridade> = {
  baixa: 'media',
  media: 'alta',
  alta: 'critica',
  critica: 'critica',
};

function baseParaStatus(status: StatusPendencia): { base: Prioridade; motivoBase: string } {
  switch (status) {
    case 'divergencia':
      return { base: 'alta', motivoBase: 'a ocorrência foi confirmada como divergência (excedente acima da tolerância configurada, com rastreio confirmando)' };
    case 'atencao':
      return { base: 'media', motivoBase: 'o excedente está acima da tolerância configurada, mas a confirmação por rastreio é fraca' };
    case 'pendente':
      return { base: 'media', motivoBase: 'não há padrão cadastrado para comparar — a situação exige decisão, mas a gravidade não pôde ser calculada' };
    default:
      return { base: 'media', motivoBase: `status "${STATUS_PENDENCIA_LABEL[status]}" sem regra de priorização específica` };
  }
}

/* `dias` é sempre o array já lido do workspace ativo (useHEEngineData) — a reincidência calculada
 * aqui nunca mistura colaboradores de outro workspace, pela mesma razão que nenhuma outra tela que
 * usa `dias` mistura (ele já vem filtrado por workspace na origem). */
export function recomendarPrioridade(
  pendencia: Pendencia,
  item: HEItemComputed,
  dias: HEDiaComputed[],
  recurrenceLimit: number,
): RecomendacaoPrioridade | null {
  if (estadoResolvido(pendencia.status)) return null;

  const agregados = agregarPorMotorista(dias);
  const meuAgregado = agregados.find((a) => a.key === item._key);
  const diasAcimaPadrao = meuAgregado?.diasAcimaPadrao ?? 0;
  const reincidenteCritico = diasAcimaPadrao > recurrenceLimit;

  const { base, motivoBase } = baseParaStatus(pendencia.status);
  let prioridade = base;
  let motivo = `Prioridade ${PRIORIDADE_LABEL[base]} porque ${motivoBase}.`;

  if (reincidenteCritico) {
    prioridade = PROXIMO_NIVEL[base];
    motivo += ` Elevada para ${PRIORIDADE_LABEL[prioridade]} porque o colaborador já ficou acima do padrão em ${diasAcimaPadrao} dia(s) no período analisado, ultrapassando o limite de reincidência configurado (${recurrenceLimit}).`;
  }

  return {
    prioridade,
    motivo,
    sinais: [
      { label: 'Status da pendência', valor: STATUS_PENDENCIA_LABEL[pendencia.status] },
      { label: 'Dias acima do padrão (colaborador, período analisado)', valor: String(diasAcimaPadrao) },
      { label: 'Limite de reincidência configurado (workspace atual)', valor: String(recurrenceLimit) },
      { label: 'Reincidência crítica', valor: reincidenteCritico ? 'Sim' : 'Não' },
    ],
  };
}
