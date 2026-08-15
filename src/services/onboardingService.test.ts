/* Onboarding — progresso DERIVADO do cadastro real, nunca um flag salvo.
 * Ver ONBOARDING.md. */
import { describe, it, expect } from 'vitest';
import { calcularProgresso, ambienteVazio } from './onboardingService';
import { workspace } from '../testing/fixtures';
import { regrasPadrao } from '../domain';

describe('onboardingService.calcularProgresso', () => {
  it('começa com os passos de cadastro pendentes numa empresa nova', () => {
    const p = calcularProgresso(workspace(), false);
    expect(p.prontoParaOperar).toBe(false);
    expect(p.essenciaisPendentes.map((x) => x.chave)).toContain('setores');
    expect(p.essenciaisPendentes.map((x) => x.chave)).toContain('escalas');
    expect(p.essenciaisPendentes.map((x) => x.chave)).toContain('dados');
  });

  it('reflete o cadastro real — marcar setores muda o progresso sem salvar flag nenhum', () => {
    const semSetor = calcularProgresso(workspace(), false);
    const comSetor = calcularProgresso(
      workspace({ departments: [{ id: 'd1', nome: 'Produção', unidadeId: null, responsavel: '' }] }),
      false,
    );
    expect(comSetor.concluidos).toBe(semSetor.concluidos + 1);
  });

  it('REGRIDE quando o cadastro é desfeito — é isso que um flag salvo não conseguiria fazer', () => {
    const ws = workspace({ schedules: [{ id: 's1', nome: 'Turno', entrada: '08:00', saida: '17:00', diasTrabalhados: [], folgas: [], heProgramadaMin: 0 }] });
    const antes = calcularProgresso(ws, true);
    const depois = calcularProgresso({ ...ws, schedules: [] }, true);
    expect(depois.concluidos).toBeLessThan(antes.concluidos);
    expect(depois.prontoParaOperar).toBe(false);
  });

  it('aponta o próximo passo priorizando os essenciais', () => {
    const p = calcularProgresso(workspace(), false);
    expect(p.proximo?.essencial).toBe(true);
  });

  it('fica pronto para operar quando todos os essenciais estão resolvidos', () => {
    const ws = workspace({
      units: [{ id: 'u1', nome: 'Matriz', codigo: '', localizacao: '' }],
      departments: [{ id: 'd1', nome: 'Produção', unidadeId: null, responsavel: '' }],
      schedules: [{ id: 's1', nome: 'Turno', entrada: '08:00', saida: '17:00', diasTrabalhados: [], folgas: [], heProgramadaMin: 0 }],
      employees: [{ id: 'e1', nome: 'Alguém', matricula: '', cargo: '', setorId: null, unidadeId: null, status: 'ativo', escalaId: null }],
    });
    const p = calcularProgresso(ws, true);
    expect(p.prontoParaOperar).toBe(true);
    expect(p.essenciaisPendentes).toHaveLength(0);
  });

  it('não conta a meta diária como configurada enquanto estiver zerada', () => {
    // dailyGoalMin = 0 significa "não configurada", não "meta é zero".
    const semMeta = calcularProgresso(workspace(), false);
    const comMeta = calcularProgresso(workspace({ rules: { ...regrasPadrao(), dailyGoalMin: 600 } }), false);
    expect(comMeta.concluidos).toBe(semMeta.concluidos + 1);
  });

  it('explica por que cada passo existe', () => {
    for (const passo of calcularProgresso(workspace(), false).passos) {
      expect(passo.porque.length).toBeGreaterThan(20);
      expect(passo.destino).toBeTruthy();
    }
  });

  it('calcula o percentual coerente com o número de passos concluídos', () => {
    const p = calcularProgresso(workspace(), false);
    expect(p.percentual).toBe(Math.round((p.concluidos / p.total) * 100));
  });
});

describe('onboardingService.ambienteVazio', () => {
  it('reconhece empresa recém-criada como ambiente vazio', () => {
    expect(ambienteVazio(workspace(), false)).toBe(true);
  });

  it('deixa de ser vazio assim que há dados processados', () => {
    expect(ambienteVazio(workspace(), true)).toBe(false);
  });
});
