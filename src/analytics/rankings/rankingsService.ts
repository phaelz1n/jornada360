/* Serviço de Rankings e Ordenações Analíticas (Camada Gold).
 *
 * Princípio: Funções de classificação para evidenciar os maiores ofensores de custo (excedente),
 * colaboradores que demandam suporte em conformidade e setores com maior índice de divergência.
 */
import type { LinhaRanking, IndicadorColaborador, IndicadorSetor } from '../types';

export function rankingMaiorExcedente(colaboradores: IndicadorColaborador[], limite = 5): LinhaRanking[] {
  return colaboradores
    .filter((c) => c.excedenteTotalMin > 0)
    .slice(0, limite)
    .map((c) => ({
      chave: c.chave,
      label: c.nome,
      sublabel: c.setorMaisComum,
      valor: c.excedenteTotalMin,
      valorSecundario: c.diasAcimaPadrao,
    }));
}

export function rankingMenorConformidade(colaboradores: IndicadorColaborador[], limite = 5): LinhaRanking[] {
  return [...colaboradores]
    .filter((c) => c.diasAnalisados > 0 && c.conformidadePct < 100)
    .sort((a, b) => a.conformidadePct - b.conformidadePct)
    .slice(0, limite)
    .map((c) => ({
      chave: c.chave,
      label: c.nome,
      sublabel: c.setorMaisComum,
      valor: c.conformidadePct,
      valorSecundario: c.diasAnalisados,
    }));
}

export function rankingSetoresComDivergencia(setores: IndicadorSetor[], limite = 5): LinhaRanking[] {
  return [...setores]
    .filter((s) => s.divergencias > 0)
    .sort((a, b) => b.divergencias - a.divergencias)
    .slice(0, limite)
    .map((s) => ({
      chave: s.setor,
      label: s.setor,
      sublabel: `${s.casos} caso(s)`,
      valor: s.divergencias,
      valorSecundario: s.heTotalMin,
    }));
}
