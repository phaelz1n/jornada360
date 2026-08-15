/* Ciclo de vida da Pendência: materialização, resolução, revisão e reabertura.
 * O teste mais importante aqui é o que impede a sincronização de apagar uma decisão humana.
 * Ver BUSINESS_RULES.md § Pendência como entidade própria e § Aprovação/reprovação.
 *
 * FASE 4: o service deixou de fazer I/O — ele CALCULA o estado desejado e devolve; quem grava é a
 * camada de dados. Por isso estes testes não tocam armazenamento nenhum: eles exercitam as regras
 * como funções puras, que é o que elas passaram a ser. Um "repositório em memória" (um Map) faz o
 * papel de quem persistiria, exatamente como a interface faz. */
import { describe, it, expect } from 'vitest';
import {
  sincronizarPendencias,
  idDaPendencia,
  atualizarPrioridade,
  atualizarResponsavel,
  atualizarPrazo,
  sugerirPrazo,
  reabrirRevisao,
  estadoResolvido,
  ordenarPendencias,
  resumoPendencias,
  acaoNecessaria,
  situacaoRevisao,
} from './pendenciaService';
import { itemComputed, diaComputed, pendencia } from '../testing/fixtures';
import type { Employee, Pendencia } from '../domain';
import type { HEDiaComputed } from '../engine/useHEEngineData';

const WS = 'empresa-teste';
const SEM_COLABORADORES: Employee[] = [];

/* Faz o papel de quem persiste: aplica o que a sincronização devolveu, do mesmo jeito que a tela
 * faz ao gravar no conjunto de repositórios ativo. */
function aplicar(estado: Pendencia[], alteradas: Pendencia[]): Pendencia[] {
  const porId = new Map(estado.map((p) => [p.id, p]));
  for (const p of alteradas) porId.set(p.id, p);
  return [...porId.values()];
}

function sincronizar(dias: HEDiaComputed[], estado: Pendencia[] = []): Pendencia[] {
  return aplicar(estado, sincronizarPendencias(WS, dias, estado, SEM_COLABORADORES));
}

describe('pendenciaService.sincronizarPendencias', () => {
  it('não materializa casos dentro do padrão — não há o que rastrear', () => {
    expect(sincronizar([diaComputed('2026-08-01', [itemComputed({ _padraoStatus: 'dentro' })])])).toHaveLength(0);
  });

  it('materializa um caso fora do padrão', () => {
    expect(sincronizar([diaComputed('2026-08-01', [itemComputed({ _padraoStatus: 'acima' })])])).toHaveLength(1);
  });

  it('é idempotente — sincronizar de novo não duplica', () => {
    const dias = [diaComputed('2026-08-01', [itemComputed({ _padraoStatus: 'acima' })])];
    let estado = sincronizar(dias);
    estado = sincronizar(dias, estado);
    estado = sincronizar(dias, estado);
    expect(estado).toHaveLength(1);
  });

  /* Sem isto, abrir a tela reenviaria ao servidor centenas de pendências idênticas às que já estão
   * lá — custo de rede e trilha de auditoria poluída, sem nenhuma informação nova. */
  it('não devolve nada para gravar quando nada mudou', () => {
    const dias = [diaComputed('2026-08-01', [itemComputed({ _padraoStatus: 'acima' })])];
    const estado = sincronizar(dias);
    expect(sincronizarPendencias(WS, dias, estado, SEM_COLABORADORES)).toHaveLength(0);
  });

  it('gera id determinístico a partir de empresa + dia + colaborador', () => {
    const item = itemComputed({ _key: 'ANA' });
    expect(idDaPendencia(WS, '2026-08-01', item)).toBe(idDaPendencia(WS, '2026-08-01', item));
    expect(idDaPendencia('outra', '2026-08-01', item)).not.toBe(idDaPendencia(WS, '2026-08-01', item));
  });

  it('nasce com prioridade neutra — sem algoritmo automático escrevendo por conta própria', () => {
    expect(sincronizar([diaComputed('2026-08-01', [itemComputed({ _padraoStatus: 'acima' })])])[0].prioridade).toBe('media');
  });

  it('vincula o colaborador do cadastro quando o nome bate, e deixa null quando não bate', () => {
    const cadastro = [{ id: 'col-1', nome: 'Ana Souza', matricula: '', cargo: '', setorId: null, unidadeId: null, status: 'ativo' as const, escalaId: null }];
    const dias = [diaComputed('2026-08-01', [itemComputed({ motorista: 'ANA SOUZA', _padraoStatus: 'acima' })])];
    expect(sincronizarPendencias(WS, dias, [], cadastro)[0].colaboradorId).toBe('col-1');
    expect(sincronizarPendencias(WS, dias, [], [])[0].colaboradorId).toBeNull();
  });
});

describe('pendenciaService — proteção da decisão humana de revisão', () => {
  /* Este bloco é o mais crítico do arquivo. `statusDoCaso` nunca devolve aprovado/reprovado, e o
   * caso continua `done: true` no motor. Sem `statusAlvoSincronizacao`, toda sincronização
   * reclassificaria o caso revisado de volta para "justificado", apagando a decisão em silêncio. */
  const diasResolvido = [diaComputed('2026-08-01', [itemComputed({ _key: 'ANA', _padraoStatus: 'acima', _done: true })])];
  const id = idDaPendencia(WS, '2026-08-01', itemComputed({ _key: 'ANA' }));

  /* A revisão acontece no servidor (rota própria, autor vindo da sessão) — aqui simulamos o
   * resultado dela para provar que a sincronização seguinte a respeita. */
  function revisada(estado: Pendencia[], decisao: 'aprovado' | 'reprovado'): Pendencia[] {
    return estado.map((p) =>
      p.id === id
        ? { ...p, status: decisao, revisadoPor: 'revisor', revisadoEm: '2026-08-14T12:00:00.000Z', observacaoRevisao: 'Conferido.' }
        : p,
    );
  }

  it('NÃO sobrescreve uma pendência aprovada ao sincronizar de novo', () => {
    const estado = revisada(sincronizar(diasResolvido), 'aprovado');
    expect(sincronizar(diasResolvido, estado).find((p) => p.id === id)?.status).toBe('aprovado');
  });

  it('NÃO sobrescreve uma pendência reprovada ao sincronizar de novo', () => {
    const estado = revisada(sincronizar(diasResolvido), 'reprovado');
    expect(sincronizar(diasResolvido, estado).find((p) => p.id === id)?.status).toBe('reprovado');
  });

  it('não confunde a data de revisão com a data de resolução', () => {
    // São eventos distintos: resolver e aprovar podem ser de pessoas e momentos diferentes.
    const estado = sincronizar(diasResolvido);
    const antes = estado[0].resolvidaEm;
    expect(revisada(estado, 'aprovado')[0].resolvidaEm).toBe(antes);
  });

  it('ao reabrir, limpa a revisão e a resolução mas PRESERVA prazo e responsável', () => {
    // O trabalho continua atribuído à mesma pessoa, com o mesmo prazo; só a decisão foi desfeita.
    let estado = sincronizar(diasResolvido);
    estado = estado.map((p) => atualizarPrazo(atualizarResponsavel(p, 'u1'), '2026-08-20'));
    estado = revisada(estado, 'reprovado');
    estado = estado.map((p) => (p.id === id ? reabrirRevisao(p) : p));

    // Reabrir no motor: o caso deixa de estar `done`.
    estado = sincronizar([diaComputed('2026-08-01', [itemComputed({ _key: 'ANA', _padraoStatus: 'acima', _done: false })])], estado);

    const p = estado.find((x) => x.id === id);
    expect(p?.status).not.toBe('reprovado');
    expect(p?.revisadoPor).toBeNull();
    expect(p?.resolvidaEm).toBeNull();
    expect(p?.resolucao).toBeNull();
    expect(p?.responsavelId).toBe('u1');
    expect(p?.prazo).toBe('2026-08-20');
  });
});

describe('pendenciaService — responsável, prazo e prioridade', () => {
  const dias = [diaComputed('2026-08-01', [itemComputed({ _key: 'ANA', _padraoStatus: 'acima' })])];

  it('persiste responsável e prazo na própria pendência', () => {
    const p = atualizarPrazo(atualizarResponsavel(sincronizar(dias)[0], 'u1'), '2026-08-20');
    expect(p.responsavelId).toBe('u1');
    expect(p.prazo).toBe('2026-08-20');
  });

  it('sugere prazo a partir da criação mais os dias configurados, sem aplicar sozinho', () => {
    const p = pendencia({ criadaEm: '2026-08-01T10:00:00.000Z', prazo: null });
    expect(sugerirPrazo(p, 3)).toBe('2026-08-04');
    // A sugestão não altera a pendência — aplicar é ação explícita da tela.
    expect(p.prazo).toBeNull();
  });

  it('respeita o prazo padrão configurado por empresa', () => {
    const p = pendencia({ criadaEm: '2026-08-01T10:00:00.000Z' });
    expect(sugerirPrazo(p, 7)).toBe('2026-08-08');
  });

  it('altera a prioridade sem tocar no estado do caso no motor', () => {
    const p = atualizarPrioridade(sincronizar(dias)[0], 'critica');
    expect(p.prioridade).toBe('critica');
    expect(p.status).toBe('divergencia');
  });
});

describe('pendenciaService — fila e resumo', () => {
  it('ordena por prioridade e, em empate, pelo caso mais antigo', () => {
    const lista = [
      pendencia({ id: '1', prioridade: 'media', data: '2026-08-01' }),
      pendencia({ id: '2', prioridade: 'critica', data: '2026-08-10' }),
      pendencia({ id: '3', prioridade: 'alta', data: '2026-08-05' }),
      pendencia({ id: '4', prioridade: 'critica', data: '2026-08-02' }),
    ];
    expect(ordenarPendencias(lista).map((p) => p.id)).toEqual(['4', '2', '3', '1']);
  });

  it('conta abertas e resolvidas separadamente', () => {
    const r = resumoPendencias([
      pendencia({ id: '1', status: 'divergencia', prioridade: 'critica' }),
      pendencia({ id: '2', status: 'atencao', prioridade: 'alta' }),
      pendencia({ id: '3', status: 'justificado' }),
      pendencia({ id: '4', status: 'aprovado' }),
    ]);
    expect(r.abertas).toBe(2);
    expect(r.resolvidas).toBe(2);
    expect(r.criticas).toBe(1);
    expect(r.altaPrioridade).toBe(1);
  });

  it('considera justificado, aprovado e reprovado como resolvidos', () => {
    expect(estadoResolvido('justificado')).toBe(true);
    expect(estadoResolvido('aprovado')).toBe(true);
    expect(estadoResolvido('reprovado')).toBe(true);
    expect(estadoResolvido('divergencia')).toBe(false);
    expect(estadoResolvido('atencao')).toBe(false);
    expect(estadoResolvido('pendente')).toBe(false);
  });
});

describe('pendenciaService — ação necessária e situação da revisão', () => {
  it('pede responsável antes de investigar quando não há um designado', () => {
    expect(acaoNecessaria(pendencia({ status: 'divergencia', responsavelId: null }))).toContain('responsável');
  });

  it('pede investigação quando já existe responsável', () => {
    expect(acaoNecessaria(pendencia({ status: 'divergencia', responsavelId: 'u1' }))).toContain('Investigar');
  });

  it('pede cadastro de horário padrão quando o caso está pendente por falta de padrão', () => {
    expect(acaoNecessaria(pendencia({ status: 'pendente' }))).toContain('horário padrão');
  });

  it('pede revisão para o que já foi resolvido', () => {
    expect(acaoNecessaria(pendencia({ status: 'justificado' }))).toContain('Revisar');
  });

  it('pede reabertura para o que foi reprovado', () => {
    expect(acaoNecessaria(pendencia({ status: 'reprovado' }))).toContain('Reabrir');
  });

  it('descreve a situação da revisão em uma frase legível', () => {
    expect(situacaoRevisao(pendencia({ status: 'justificado' }))).toContain('Aguardando');
    expect(situacaoRevisao(pendencia({ status: 'divergencia' }))).toContain('não resolvida');
    const aprovada = pendencia({ status: 'aprovado', revisadoPor: 'ana', revisadoEm: '2026-08-14T10:00:00.000Z' });
    expect(situacaoRevisao(aprovada)).toContain('ana');
  });
});
