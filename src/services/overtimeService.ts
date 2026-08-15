/* Cálculo de horas extras: programada × realizada × excedente, e se está dentro do padrão
 * configurado. Usa toleranceService — não recalcula a regra de tolerância aqui de novo.
 *
 * `resumoPorColaborador` é a função que a tela de Horas Extras chama (nunca importa
 * heAggregations diretamente) — delega em `agregarPorMotorista`, não duplica a soma.
 * `calcularHoraExtraDoDia` é uma consulta pontual (um colaborador, um dia) que usa
 * OvertimeRepository pra buscar o item bruto — usada pela ficha de pendência, pra mostrar o
 * cálculo de HE pela mesma via de sempre em vez de ler campos crus do item diretamente. */
import { heEfetivo, itemKey, normName, type HECaseState, type HEItemRaw } from '../engine/heEngineCore';
import { classificar } from './toleranceService';
import { agregarPorMotorista, type MotoristaAgregado } from '../engine/heAggregations';
export type { MotoristaAgregado } from '../engine/heAggregations';
import { OvertimeRepository } from '../repositories/OvertimeRepository';
import { TimeRecordRepository } from '../repositories/TimeRecordRepository';
import type { HEDiaComputed } from '../engine/useHEEngineData';

export interface HECalculado {
  heProgramadaMin: number;
  heRealizadaMin: number;
  heExcedenteMin: number;
  dentroDoPadrao: boolean;
}

export function calcularHoraExtra(
  item: HEItemRaw,
  caseState: HECaseState | undefined,
  toleranceMin: number,
): HECalculado {
  const realizada = heEfetivo(item, caseState);
  const { padraoStatus, excedenteMin } = classificar(item, realizada, toleranceMin);
  return {
    heProgramadaMin: item.padraoMin ?? 0,
    heRealizadaMin: realizada,
    heExcedenteMin: Math.max(0, excedenteMin),
    dentroDoPadrao: padraoStatus === 'dentro',
  };
}

/* Resumo agregado de HE por colaborador — o que a tela Horas Extras exibe. `dias` já vem
 * calculado (reclassificado) de useHEEngineData(); esta função só reexpõe agregarPorMotorista sob
 * o nome de domínio certo, sem duplicar a soma. */
export function resumoPorColaborador(dias: HEDiaComputed[]): MotoristaAgregado[] {
  return agregarPorMotorista(dias);
}

/* Consulta pontual: HE de UM colaborador em UM dia, buscando o item bruto via OvertimeRepository
 * (que delega em TimeRecordRepository) em vez de esperar receber o item já resolvido. */
export function calcularHoraExtraDoDia(
  workspaceId: string,
  dateKey: string,
  colaborador: string,
  toleranceMin: number,
): HECalculado | null {
  const items = OvertimeRepository.listItemsForDay(workspaceId, dateKey);
  const chave = normName(colaborador);
  const item = items.find((i) => itemKey(i) === chave);
  if (!item) return null;
  const caseState = TimeRecordRepository.getCaseState(workspaceId, dateKey)[chave];
  return calcularHoraExtra(item, caseState, toleranceMin);
}
