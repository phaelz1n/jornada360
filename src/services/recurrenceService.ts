/* Reincidência: quantos dias, no período analisado, cada colaborador ficou acima do padrão — e se
 * já passou do limite configurado (workspace.rules.recurrenceLimit) que merece sinalização. */
import { agregarPorMotorista, type MotoristaAgregado } from '../engine/heAggregations';
import type { HEDiaComputed } from '../engine/useHEEngineData';

export interface ReincidenciaColaborador extends MotoristaAgregado {
  critico: boolean;
}

export function calcularReincidencia(dias: HEDiaComputed[], recurrenceLimit: number): ReincidenciaColaborador[] {
  return agregarPorMotorista(dias)
    .filter((m) => m.diasAcimaPadrao > 0)
    .map((m) => ({ ...m, critico: m.diasAcimaPadrao > recurrenceLimit }))
    .sort((a, b) => b.diasAcimaPadrao - a.diasAcimaPadrao || b.excedenteTotalMin - a.excedenteTotalMin);
}
