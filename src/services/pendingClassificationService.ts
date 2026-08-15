/* Decide quais casos viram pendência (precisam de decisão humana): quem está fora do padrão
 * configurado e ainda não foi marcado como resolvido. Extraído de dentro do componente de tela
 * (antes vivia como useMemo em RealPendenciasSection.tsx) — regra de negócio não deve morar em
 * componente React. */
import type { HEDiaComputed, HEItemComputed } from '../engine/useHEEngineData';
import type { StatusPendencia } from '../domain/Pendencia';

export interface CasoPendente {
  dia: HEDiaComputed;
  item: HEItemComputed;
}

export function listarPendencias(dias: HEDiaComputed[], incluirResolvidas = false): CasoPendente[] {
  const out: CasoPendente[] = [];
  for (const dia of dias) {
    for (const item of dia.items) {
      if (item._padraoStatus === 'dentro') continue;
      if (!incluirResolvidas && item._done) continue;
      out.push({ dia, item });
    }
  }
  return out.sort((a, b) => b.dia.dateKey.localeCompare(a.dia.dateKey) || b.item._heMin - a.item._heMin);
}

/* Deriva o StatusPendencia unificado (domain/Pendencia.ts) a partir de campos que o motor real e o
 * toleranceService JÁ calculam (`_padraoStatus`, `_status`, `_done`, `_justificativa`) — não
 * recalcula nada, só normaliza/nomeia de forma consistente o que hoje aparece espalhado em badges
 * diferentes por tela (PadraoStatusBadge, ItemStatusBadge). Ordem de precedência:
 *
 * 1. `_padraoStatus === 'dentro'`             → normal        (motor já confirma: sem divergência)
 * 2. `_done === true` (e não é 'dentro')       → justificado   (ver limitação abaixo)
 * 3. `_padraoStatus` é 'sem_cadastro'/'invalido' → pendente    (sem padrão confiável pra comparar —
 *                                                                 não dá pra classificar severidade,
 *                                                                 só sinalizar que precisa de decisão)
 * 4. `_padraoStatus === 'acima'` e `_status` é 'leve'/'sem_dado' → atencao (sinal fraco de rastreio —
 *                                                                 merece olhar, ainda não é uma
 *                                                                 divergência confirmada com segurança)
 * 5. `_padraoStatus === 'acima'` (status 'forte' ou 'ok')       → divergencia (excedente confirmado
 *                                                                 pelo padrão E pelo rastreio)
 *
 * LIMITAÇÕES CONHECIDAS (documentadas em vez de inventar regra — ver BUSINESS_RULES.md):
 * - 'aprovado' e 'reprovado' NUNCA são retornados por esta função. `HECaseState` (heEngineCore.ts)
 *   não tem nenhum campo que registre uma decisão de aprovação/reprovação separada de "done" — só
 *   existe `done: boolean`. Não é possível distinguir com segurança "resolvido e aprovado" de
 *   "resolvido e reprovado" com o dado disponível hoje. Os dois valores existem no tipo (o conceito
 *   de domínio foi pedido), mas ficam sem produtor até existir um campo de decisão de revisão —
 *   isso é trabalho de uma etapa futura, não desta.
 * - `_done === true` sem `_justificativa` preenchida ainda cai em 'justificado' (regra 2 acima), mas
 *   isso é uma imprecisão conhecida: a tela permite clicar "Marcar resolvido" sem preencher
 *   justificativa (ver RealPendenciasSection.tsx), então "justificado" aqui cobre tanto "resolvido
 *   com explicação" quanto "resolvido sem explicação registrada". A taxonomia de 7 valores pedida
 *   não tem um estado próprio para "resolvido sem justificativa" — não foi inventado um. */
export function statusDoCaso(item: HEItemComputed): StatusPendencia {
  if (item._padraoStatus === 'dentro') return 'normal';
  if (item._done) return 'justificado';
  if (item._padraoStatus === 'sem_cadastro' || item._padraoStatus === 'invalido') return 'pendente';
  if (item._status === 'leve' || item._status === 'sem_dado') return 'atencao';
  return 'divergencia';
}
