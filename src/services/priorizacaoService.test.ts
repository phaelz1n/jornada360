/* Priorização — recomendação determinística. Duas garantias que estes testes protegem:
 * a mesma entrada sempre produz a mesma saída, e recomendar nunca é decidir.
 * Ver BUSINESS_RULES.md § Priorização operacional. */
import { describe, it, expect } from 'vitest';
import { recomendarPrioridade } from './priorizacaoService';
import { itemComputed, diaComputed, pendencia } from '../testing/fixtures';

/* Monta N dias em que o mesmo colaborador ficou acima do padrão — a base da reincidência. */
function diasComReincidencia(n: number) {
  return Array.from({ length: n }, (_, i) =>
    diaComputed(`2026-08-${String(i + 1).padStart(2, '0')}`, [
      itemComputed({ _key: 'COLAB', _padraoStatus: 'acima', _excedenteMin: 30, _heMin: 90 }),
    ]),
  );
}

const item = itemComputed({ _key: 'COLAB' });

describe('priorizacaoService.recomendarPrioridade', () => {
  it('não recomenda nada para pendência já resolvida', () => {
    // Recomendar prioridade para algo resolvido seria ruído na fila.
    for (const status of ['justificado', 'aprovado', 'reprovado'] as const) {
      expect(recomendarPrioridade(pendencia({ status }), item, diasComReincidencia(1), 5)).toBeNull();
    }
  });

  it('recomenda Alta para divergência confirmada', () => {
    const r = recomendarPrioridade(pendencia({ status: 'divergencia' }), item, diasComReincidencia(1), 5);
    expect(r?.prioridade).toBe('alta');
  });

  it('recomenda Média para atenção (rastreio fraco)', () => {
    const r = recomendarPrioridade(pendencia({ status: 'atencao' }), item, diasComReincidencia(1), 5);
    expect(r?.prioridade).toBe('media');
  });

  it('recomenda Média para pendente (sem padrão para comparar)', () => {
    const r = recomendarPrioridade(pendencia({ status: 'pendente' }), item, diasComReincidencia(1), 5);
    expect(r?.prioridade).toBe('media');
  });

  it('NUNCA recomenda Baixa — recomendar significa que algo exige atenção', () => {
    for (const status of ['divergencia', 'atencao', 'pendente'] as const) {
      const r = recomendarPrioridade(pendencia({ status }), item, diasComReincidencia(1), 5);
      expect(r?.prioridade).not.toBe('baixa');
    }
  });

  it('eleva um nível quando o colaborador passou do limite de reincidência', () => {
    // 6 dias acima do padrão com limite 5 → reincidente crítico → Alta vira Crítica.
    const r = recomendarPrioridade(pendencia({ status: 'divergencia' }), item, diasComReincidencia(6), 5);
    expect(r?.prioridade).toBe('critica');
  });

  it('não eleva quando a reincidência está exatamente no limite', () => {
    // A regra é "> limite", não ">=" — mesma fronteira do ranking de reincidência.
    const r = recomendarPrioridade(pendencia({ status: 'divergencia' }), item, diasComReincidencia(5), 5);
    expect(r?.prioridade).toBe('alta');
  });

  it('usa o limite configurado por empresa, não um valor fixo', () => {
    const dias = diasComReincidencia(4);
    expect(recomendarPrioridade(pendencia({ status: 'divergencia' }), item, dias, 5)?.prioridade).toBe('alta');
    expect(recomendarPrioridade(pendencia({ status: 'divergencia' }), item, dias, 2)?.prioridade).toBe('critica');
  });

  it('não passa de Crítica ao elevar', () => {
    const r = recomendarPrioridade(pendencia({ status: 'divergencia' }), item, diasComReincidencia(50), 1);
    expect(r?.prioridade).toBe('critica');
  });

  it('é determinística — mesma entrada, mesma saída', () => {
    const dias = diasComReincidencia(3);
    const p = pendencia({ status: 'divergencia' });
    const a = recomendarPrioridade(p, item, dias, 5);
    const b = recomendarPrioridade(p, item, dias, 5);
    expect(a).toEqual(b);
  });

  it('sempre explica o motivo e expõe os sinais usados', () => {
    // A recomendação sem explicação seria uma caixa-preta — o produto inteiro se apoia em
    // conseguir dizer por que cada número apareceu.
    const r = recomendarPrioridade(pendencia({ status: 'divergencia' }), item, diasComReincidencia(6), 5);
    expect(r?.motivo).toBeTruthy();
    expect(r?.sinais.length).toBeGreaterThan(0);
    expect(r?.motivo).toContain('reincidência');
  });
});
