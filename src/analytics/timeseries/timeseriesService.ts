/* Serviço de Séries Temporais e Evolução Histórica (Camada Gold).
 *
 * Princípio: Agrupamentos cronológicos de dias apurados (diário e mensal)
 * sem interpolação de dados inexistentes, preservando integridade das medições.
 */
import type { HEDiaComputed } from '../../engine/useHEEngineData';
import type { PontoTemporal } from '../types';
import { pct, ehDivergencia } from '../kpis/kpiService';

export function calcularEvolucaoDiaria(dias: HEDiaComputed[]): PontoTemporal[] {
  return [...dias]
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    .map((d) => {
      const divergencias = d.items.filter(ehDivergencia).length;
      return {
        chave: d.dateKey,
        label: d.dateLabel,
        heTotalMin: d.totalHEAtual,
        divergencias,
        registros: d.items.length,
        conformidadePct: pct(d.items.length - divergencias, d.items.length),
      };
    });
}

export function calcularEvolucaoMensal(dias: HEDiaComputed[]): PontoTemporal[] {
  const map = new Map<string, { he: number; div: number; reg: number }>();
  for (const d of dias) {
    const mk = d.dateKey.slice(0, 7);
    const acc = map.get(mk) || { he: 0, div: 0, reg: 0 };
    acc.he += d.totalHEAtual;
    acc.div += d.items.filter(ehDivergencia).length;
    acc.reg += d.items.length;
    map.set(mk, acc);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([mk, a]) => {
      const [ano, mes] = mk.split('-');
      return {
        chave: mk,
        label: `${mes}/${ano}`,
        heTotalMin: a.he,
        divergencias: a.div,
        registros: a.reg,
        conformidadePct: pct(a.reg - a.div, a.reg),
      };
    });
}
