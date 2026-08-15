/* Alertas de jornada (interjornada e intervalo). O motor detecta; este service é a porta de
 * leitura. Ver BUSINESS_RULES.md § Regras de jornada. */
import { describe, it, expect } from 'vitest';
import { alertasDeJornada, temAlertaDeJornada, interjornadaCritica, intervaloIrregular } from './journeyService';
import { itemComputed } from '../testing/fixtures';

describe('journeyService — predicados puros', () => {
  it('interjornada: só é crítica abaixo do mínimo configurado', () => {
    expect(interjornadaCritica(10, 11)).toBe(true);
    expect(interjornadaCritica(11, 11)).toBe(false);
    expect(interjornadaCritica(12, 11)).toBe(false);
  });

  it('interjornada: gap negativo não é avaliado como crítico', () => {
    // Gap negativo indica dado inconsistente, não descanso insuficiente.
    expect(interjornadaCritica(-3, 11)).toBe(false);
  });

  it('intervalo: só é irregular abaixo do mínimo configurado', () => {
    expect(intervaloIrregular(45, 60)).toBe(true);
    expect(intervaloIrregular(60, 60)).toBe(false);
  });

  it('usa o mínimo recebido, nunca um valor fixo — empresas têm acordos diferentes', () => {
    expect(interjornadaCritica(10, 11)).toBe(true);
    expect(interjornadaCritica(10, 9)).toBe(false);
  });
});

describe('journeyService.alertasDeJornada', () => {
  it('não reporta alerta quando o motor não detectou nada', () => {
    expect(alertasDeJornada(itemComputed({ interjornada: '', intervalo: '' }))).toHaveLength(0);
    expect(temAlertaDeJornada(itemComputed({ interjornada: '', intervalo: '' }))).toBe(false);
  });

  it('reporta interjornada quando o motor preencheu a narrativa', () => {
    const a = alertasDeJornada(itemComputed({ interjornada: 'Só 8.5h de descanso' }));
    expect(a).toHaveLength(1);
    expect(a[0].tipo).toBe('interjornada');
    expect(a[0].descricao).toContain('8.5h');
  });

  it('reporta os dois alertas quando ambos existem', () => {
    const a = alertasDeJornada(itemComputed({ interjornada: 'Só 8h', intervalo: 'Pausa de 20min' }));
    expect(a.map((x) => x.tipo)).toEqual(['interjornada', 'intervalo']);
  });

  it('trata snapshot antigo sem o campo intervalo sem quebrar', () => {
    // Dias processados antes de o motor calcular intervalo não têm o campo.
    const antigo = itemComputed({ interjornada: '' });
    delete (antigo as { intervalo?: string }).intervalo;
    expect(() => alertasDeJornada(antigo)).not.toThrow();
    expect(alertasDeJornada(antigo)).toHaveLength(0);
  });
});
