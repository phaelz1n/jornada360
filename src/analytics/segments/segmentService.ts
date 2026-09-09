/* Serviço de Segmentação Operacional (Camada Gold).
 *
 * Princípio: Análise de jornada segmentada por Colaborador, Setor/Departamento,
 * Unidade Operacional e Causas Prováveis.
 */
import type { HEDiaComputed } from '../../engine/useHEEngineData';
import { agregarPorMotorista, agregarPorSetor, SETOR_DENTRO_DO_PADRAO } from '../../engine/heAggregations';
import { normName } from '../../engine/heEngineCore';
import { statusDoCaso } from '../../services/pendingClassificationService';
import { temAlertaDeJornada } from '../../services/journeyService';
import type { Employee } from '../../domain/Employee';
import type { Unit } from '../../domain/Unit';
import type {
  RegistroAnalisado,
  IndicadorColaborador,
  IndicadorSetor,
  IndicadorUnidade,
  ContagemRotulada,
} from '../types';
import { pct, todosOsItens, ehDivergencia } from '../kpis/kpiService';

export const UNIDADE_NAO_VINCULADA = 'Sem vínculo com o cadastro';

export function listarRegistrosAnalisados(dias: HEDiaComputed[]): RegistroAnalisado[] {
  const out: RegistroAnalisado[] = [];
  for (const dia of dias) {
    for (const item of dia.items) {
      out.push({
        dateKey: dia.dateKey,
        dateLabel: dia.dateLabel,
        item,
        status: statusDoCaso(item),
        temAlertaJornada: temAlertaDeJornada(item),
      });
    }
  }
  return out.sort((a, b) => b.dateKey.localeCompare(a.dateKey) || b.item._heMin - a.item._heMin);
}

export function calcularPorColaborador(dias: HEDiaComputed[], recurrenceLimit: number): IndicadorColaborador[] {
  const alertasPorChave = new Map<string, number>();
  for (const item of todosOsItens(dias)) {
    if (temAlertaDeJornada(item)) alertasPorChave.set(item._key, (alertasPorChave.get(item._key) || 0) + 1);
  }
  return agregarPorMotorista(dias)
    .map((m) => ({
      chave: m.key,
      nome: m.motorista,
      setorMaisComum: m.setorMaisComum,
      diasAnalisados: m.diasAnalisados,
      diasAcimaPadrao: m.diasAcimaPadrao,
      heTotalMin: m.heTotalMin,
      excedenteTotalMin: m.excedenteTotalMin,
      conformidadePct: pct(m.diasAnalisados - m.diasAcimaPadrao, m.diasAnalisados),
      reincidenteCritico: m.diasAcimaPadrao > recurrenceLimit,
      alertasJornada: alertasPorChave.get(m.key) || 0,
    }))
    .sort((a, b) => b.excedenteTotalMin - a.excedenteTotalMin);
}

export function calcularPorSetor(dias: HEDiaComputed[]): IndicadorSetor[] {
  return agregarPorSetor(dias).map((s) => {
    const sintetico = s.setor === SETOR_DENTRO_DO_PADRAO;
    return {
      setor: s.setor,
      heTotalMin: s.heTotalMin,
      casos: s.casos,
      divergencias: sintetico ? 0 : s.registros.filter((r) => ehDivergencia(r.item)).length,
      registros: s.registros,
      sintetico,
    };
  });
}

export function calcularPorUnidade(
  dias: HEDiaComputed[],
  colaboradores: Employee[],
  unidades: Unit[],
): IndicadorUnidade[] {
  const porNome = new Map<string, Employee>();
  for (const e of colaboradores) porNome.set(normName(e.nome), e);
  const nomeUnidade = new Map<string, string>();
  for (const u of unidades) nomeUnidade.set(u.id, u.nome);

  const acc = new Map<string, { unidadeId: string | null; chaves: Set<string>; registros: number; he: number; exc: number; div: number }>();

  for (const item of todosOsItens(dias)) {
    const emp = porNome.get(normName(item.motorista));
    const unidadeId = emp?.unidadeId ?? null;
    const rotulo = unidadeId ? nomeUnidade.get(unidadeId) || 'Unidade removida do cadastro' : UNIDADE_NAO_VINCULADA;
    const a = acc.get(rotulo) || { unidadeId, chaves: new Set<string>(), registros: 0, he: 0, exc: 0, div: 0 };
    a.chaves.add(item._key);
    a.registros++;
    a.he += item._heMin;
    if (item._padraoStatus === 'acima') a.exc += item._excedenteMin;
    if (ehDivergencia(item)) a.div++;
    acc.set(rotulo, a);
  }

  return [...acc.entries()]
    .map(([unidade, a]) => ({
      unidadeId: a.unidadeId,
      unidade,
      colaboradores: a.chaves.size,
      registros: a.registros,
      heTotalMin: a.he,
      excedenteTotalMin: a.exc,
      divergencias: a.div,
      conformidadePct: pct(a.registros - a.div, a.registros),
    }))
    .sort((a, b) => b.excedenteTotalMin - a.excedenteTotalMin);
}

export function calcularPrincipaisCausas(dias: HEDiaComputed[]): ContagemRotulada[] {
  const map = new Map<string, number>();
  let total = 0;
  for (const item of todosOsItens(dias)) {
    if (item._padraoStatus === 'dentro') continue;
    const causa = item._causa?.trim() || 'Não classificada';
    map.set(causa, (map.get(causa) || 0) + 1);
    total++;
  }
  return [...map.entries()]
    .map(([label, valor]) => ({ label, valor, pct: pct(valor, total) }))
    .sort((a, b) => b.valor - a.valor);
}
