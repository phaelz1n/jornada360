/* Taxonomia de status unificada — a classificação que aparece em Pendências, Centro de Ações,
 * Controle de Ponto e Análise por Setor. Precisa ser a MESMA nas quatro.
 * Ver BUSINESS_RULES.md § Taxonomia de status unificada. */
import { describe, it, expect } from 'vitest';
import { statusDoCaso, listarPendencias } from './pendingClassificationService';
import { itemComputed, diaComputed } from '../testing/fixtures';

describe('pendingClassificationService.statusDoCaso', () => {
  it('classifica como normal quando o padrão confirma que está dentro', () => {
    expect(statusDoCaso(itemComputed({ _padraoStatus: 'dentro' }))).toBe('normal');
  });

  it('classifica como justificado quando o caso foi resolvido, qualquer que seja o padrão', () => {
    expect(statusDoCaso(itemComputed({ _padraoStatus: 'acima', _done: true }))).toBe('justificado');
  });

  it('prioriza "resolvido" sobre a severidade da divergência', () => {
    // A ordem de precedência importa: um caso grave já tratado não deve voltar à fila.
    const grave = itemComputed({ _padraoStatus: 'acima', _status: 'forte', _done: true });
    expect(statusDoCaso(grave)).toBe('justificado');
  });

  it('classifica como pendente quando não há padrão cadastrado para comparar', () => {
    expect(statusDoCaso(itemComputed({ _padraoStatus: 'sem_cadastro', _done: false }))).toBe('pendente');
    expect(statusDoCaso(itemComputed({ _padraoStatus: 'invalido', _done: false }))).toBe('pendente');
  });

  it('classifica como atenção quando o excedente existe mas o rastreio é fraco', () => {
    expect(statusDoCaso(itemComputed({ _padraoStatus: 'acima', _status: 'leve' }))).toBe('atencao');
    expect(statusDoCaso(itemComputed({ _padraoStatus: 'acima', _status: 'sem_dado' }))).toBe('atencao');
  });

  it('classifica como divergência quando padrão e rastreio confirmam', () => {
    expect(statusDoCaso(itemComputed({ _padraoStatus: 'acima', _status: 'forte' }))).toBe('divergencia');
    expect(statusDoCaso(itemComputed({ _padraoStatus: 'acima', _status: 'ok' }))).toBe('divergencia');
  });

  it('NUNCA produz aprovado ou reprovado — esses exigem decisão humana', () => {
    // Limitação documentada e intencional: statusDoCaso deriva do motor, que não tem campo de
    // revisão. Se esta regra mudar sem querer, a sincronização passaria a sobrescrever decisões
    // humanas de aprovação/reprovação.
    const combinacoes = [
      itemComputed({ _padraoStatus: 'dentro' }),
      itemComputed({ _padraoStatus: 'acima', _done: true }),
      itemComputed({ _padraoStatus: 'acima', _status: 'forte' }),
      itemComputed({ _padraoStatus: 'sem_cadastro' }),
      itemComputed({ _padraoStatus: 'invalido' }),
      itemComputed({ _padraoStatus: 'acima', _status: 'leve' }),
    ];
    for (const item of combinacoes) {
      expect(['aprovado', 'reprovado']).not.toContain(statusDoCaso(item));
    }
  });
});

describe('pendingClassificationService.listarPendencias', () => {
  const dia = diaComputed('2026-08-01', [
    itemComputed({ _key: 'A', _padraoStatus: 'dentro', _heMin: 30 }),
    itemComputed({ _key: 'B', _padraoStatus: 'acima', _heMin: 120, _done: false }),
    itemComputed({ _key: 'C', _padraoStatus: 'acima', _heMin: 90, _done: true }),
    itemComputed({ _key: 'D', _padraoStatus: 'sem_cadastro', _heMin: 60, _done: false }),
  ]);

  it('exclui casos dentro do padrão — não há o que decidir neles', () => {
    const chaves = listarPendencias([dia]).map((c) => c.item._key);
    expect(chaves).not.toContain('A');
  });

  it('exclui casos já resolvidos por padrão', () => {
    expect(listarPendencias([dia]).map((c) => c.item._key)).not.toContain('C');
  });

  it('inclui resolvidos quando explicitamente pedido', () => {
    expect(listarPendencias([dia], true).map((c) => c.item._key)).toContain('C');
  });

  it('ordena por data decrescente e, no mesmo dia, por HE decrescente', () => {
    const ontem = diaComputed('2026-07-31', [itemComputed({ _key: 'X', _padraoStatus: 'acima', _heMin: 999 })]);
    const ordem = listarPendencias([ontem, dia]).map((c) => c.item._key);
    // O dia mais recente vem primeiro mesmo tendo HE menor que o do dia anterior.
    expect(ordem[0]).toBe('B');
    expect(ordem[ordem.length - 1]).toBe('X');
  });
});
