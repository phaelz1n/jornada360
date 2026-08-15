/* Regra de tolerância — a decisão mais importante do sistema: "isso é divergência ou não".
 * Se estes testes quebrarem, todo o resto (pendências, indicadores, score, relatórios) já está
 * classificando errado. Ver BUSINESS_RULES.md § Regra de tolerância. */
import { describe, it, expect } from 'vitest';
import { classificar } from './toleranceService';
import { itemRaw } from '../testing/fixtures';

describe('toleranceService.classificar', () => {
  it('trata diferença IGUAL à tolerância como dentro do padrão', () => {
    // Fronteira exata: a regra é "> tolerância", não ">=". Um erro aqui reclassificaria
    // silenciosamente milhares de registros ao trocar o operador.
    const item = itemRaw({ padraoMin: 60 });
    expect(classificar(item, 70, 10).padraoStatus).toBe('dentro');
  });

  it('trata diferença de 1 minuto acima da tolerância como acima do padrão', () => {
    const item = itemRaw({ padraoMin: 60 });
    expect(classificar(item, 71, 10).padraoStatus).toBe('acima');
  });

  it('usa a tolerância recebida, nunca um valor fixo', () => {
    const item = itemRaw({ padraoMin: 60 });
    // Mesmo excedente (30min) muda de classificação conforme a empresa configurou.
    expect(classificar(item, 90, 10).padraoStatus).toBe('acima');
    expect(classificar(item, 90, 45).padraoStatus).toBe('dentro');
  });

  it('calcula o excedente como HE realizada menos HE programada', () => {
    const item = itemRaw({ padraoMin: 60 });
    expect(classificar(item, 145, 10).excedenteMin).toBe(85);
  });

  it('devolve excedente negativo quando a HE ficou abaixo do padrão programado', () => {
    const item = itemRaw({ padraoMin: 60 });
    const r = classificar(item, 40, 10);
    expect(r.excedenteMin).toBe(-20);
    expect(r.padraoStatus).toBe('dentro');
  });

  it('preserva o status original quando não há padrão cadastrado', () => {
    // Sem padrão não há contra o que comparar: a regra é NÃO reclassificar, e não assumir
    // "dentro" (o que faria um cadastro incompleto parecer uma operação impecável).
    const item = itemRaw({ padraoMin: null, padraoStatus: 'sem_cadastro', status: 'sem_dado', excedenteMin: 0 });
    const r = classificar(item, 500, 10);
    expect(r.padraoStatus).toBe('sem_cadastro');
    expect(r.status).toBe('sem_dado');
    expect(r.excedenteMin).toBe(0);
  });

  it('força status "ok" quando o caso ficou dentro do padrão, mesmo com rastreio divergente', () => {
    // Dentro do padrão não é hora extra a investigar: uma diferença pontual de rastreio não
    // deve gerar pendência. Regra herdada do motor real.
    const item = itemRaw({ padraoMin: 60, rastreioStatus: 'forte' });
    expect(classificar(item, 65, 10).status).toBe('ok');
  });

  it('usa o status de rastreio quando o caso ficou acima do padrão', () => {
    const item = itemRaw({ padraoMin: 60, rastreioStatus: 'leve', status: 'forte' });
    expect(classificar(item, 200, 10).status).toBe('leve');
  });
});
