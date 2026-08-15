/* SLA — classifica um prazo que ALGUÉM definiu. Nunca inventa data-limite.
 * Ver BUSINESS_RULES.md § SLA / acompanhamento de prazo. */
import { describe, it, expect } from 'vitest';
import { calcularEstadoSla, diasDeAtraso } from './slaService';
import { pendencia } from '../testing/fixtures';

const HOJE = new Date('2026-08-14T12:00:00.000Z');

describe('slaService.calcularEstadoSla', () => {
  it('devolve sem_prazo quando ninguém definiu um prazo', () => {
    expect(calcularEstadoSla(pendencia({ prazo: null }), 1, HOJE)).toBe('sem_prazo');
  });

  it('nunca infere uma data-limite implícita a partir da criação', () => {
    // Regra crítica: sem prazo definido o sistema não estima nada, mesmo com a pendência
    // aberta há muito tempo.
    const antiga = pendencia({ prazo: null, criadaEm: '2026-01-01T00:00:00.000Z' });
    expect(calcularEstadoSla(antiga, 1, HOJE)).toBe('sem_prazo');
  });

  it('classifica como vencido quando hoje passou do prazo', () => {
    expect(calcularEstadoSla(pendencia({ prazo: '2026-08-13' }), 1, HOJE)).toBe('vencido');
  });

  it('classifica como dentro do prazo quando ainda falta mais que a antecedência', () => {
    expect(calcularEstadoSla(pendencia({ prazo: '2026-08-20' }), 1, HOJE)).toBe('dentro_prazo');
  });

  it('classifica como próximo do vencimento dentro da janela de antecedência configurada', () => {
    // Antecedência 1 dia: prazo 15/08 vira "próximo" no dia 14/08.
    expect(calcularEstadoSla(pendencia({ prazo: '2026-08-15' }), 1, HOJE)).toBe('proximo_vencimento');
  });

  it('respeita a antecedência configurada por empresa', () => {
    const p = pendencia({ prazo: '2026-08-18' });
    expect(calcularEstadoSla(p, 1, HOJE)).toBe('dentro_prazo');
    expect(calcularEstadoSla(p, 5, HOJE)).toBe('proximo_vencimento');
  });

  it('trata o próprio dia do prazo como próximo, não vencido', () => {
    expect(calcularEstadoSla(pendencia({ prazo: '2026-08-14' }), 1, HOJE)).toBe('proximo_vencimento');
  });

  it('classifica resolvida dentro do prazo quando a resolução veio até a data-limite', () => {
    const p = pendencia({ status: 'justificado', prazo: '2026-08-15', resolvidaEm: '2026-08-14T09:00:00.000Z' });
    expect(calcularEstadoSla(p, 1, HOJE)).toBe('resolvida_dentro_prazo');
  });

  it('classifica resolvida fora do prazo quando a resolução veio depois', () => {
    const p = pendencia({ status: 'justificado', prazo: '2026-08-10', resolvidaEm: '2026-08-14T09:00:00.000Z' });
    expect(calcularEstadoSla(p, 1, HOJE)).toBe('resolvida_fora_prazo');
  });

  it('considera aprovado e reprovado como estados resolvidos', () => {
    const base = { prazo: '2026-08-15', resolvidaEm: '2026-08-14T09:00:00.000Z' } as const;
    expect(calcularEstadoSla(pendencia({ ...base, status: 'aprovado' }), 1, HOJE)).toBe('resolvida_dentro_prazo');
    expect(calcularEstadoSla(pendencia({ ...base, status: 'reprovado' }), 1, HOJE)).toBe('resolvida_dentro_prazo');
  });
});

describe('slaService.diasDeAtraso', () => {
  it('conta os dias corridos entre o prazo e hoje', () => {
    expect(diasDeAtraso('2026-08-10', HOJE)).toBe(4);
  });

  it('nunca devolve menos que 1 — só é chamado quando já está vencido', () => {
    expect(diasDeAtraso('2026-08-14', HOJE)).toBe(1);
    expect(diasDeAtraso('2026-08-20', HOJE)).toBe(1);
  });
});
