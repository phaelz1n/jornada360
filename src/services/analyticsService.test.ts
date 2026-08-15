/* Indicadores. O princípio que estes testes protegem: quando um indicador não pode ser
 * calculado ele volta como null, nunca como zero ou estimativa.
 * Ver BUSINESS_RULES.md § Indicadores do Dashboard Executivo. */
import { describe, it, expect } from 'vitest';
import {
  calcularVisaoGeral,
  calcularEvolucaoDiaria,
  calcularPorSetor,
  calcularPorUnidade,
  calcularPrincipaisCausas,
  calcularIndicadoresPendencias,
  calcularPontosDeAtencao,
  UNIDADE_NAO_VINCULADA,
} from './analyticsService';
import { itemComputed, diaComputed, pendencia } from '../testing/fixtures';
import type { Employee } from '../domain/Employee';
import type { Unit } from '../domain/Unit';

const HOJE = new Date('2026-08-14T12:00:00.000Z');

describe('analyticsService.calcularVisaoGeral', () => {
  it('devolve null (não zero) em todo indicador quando não há dado nenhum', () => {
    // Zero significaria "medimos e deu zero". Null significa "não há o que medir" — a
    // diferença que impede uma empresa vazia de parecer uma operação impecável.
    const v = calcularVisaoGeral([], 0);
    for (const ind of v.indicadores) {
      expect(ind.valor).toBeNull();
      expect(ind.disponivel).toBe(false);
      expect(ind.motivoIndisponivel).toBeTruthy();
    }
  });

  it('calcula jornadas sem divergência sobre o total de registros', () => {
    const dias = [
      diaComputed('2026-08-01', [
        itemComputed({ _key: 'A', _padraoStatus: 'dentro' }),
        itemComputed({ _key: 'B', _padraoStatus: 'dentro' }),
        itemComputed({ _key: 'C', _padraoStatus: 'acima', _status: 'forte' }),
      ]),
    ];
    const ind = calcularVisaoGeral(dias, 0).indicadores.find((i) => i.chave === 'jornadas_sem_divergencia');
    expect(ind?.valor).toBeCloseTo(66.7, 1);
  });

  it('marca a meta como indisponível quando a empresa não configurou meta diária', () => {
    // O sistema nunca assume a meta de nenhuma empresa.
    const dias = [diaComputed('2026-08-01', [itemComputed({ _heMin: 500 })])];
    const meta = calcularVisaoGeral(dias, 0).indicadores.find((i) => i.chave === 'dias_acima_meta');
    expect(meta?.valor).toBeNull();
    expect(meta?.motivoIndisponivel).toContain('meta diária');
  });

  it('conta dias acima da meta quando ela foi configurada', () => {
    const dias = [
      diaComputed('2026-08-01', [itemComputed({ _heMin: 500 })]),
      diaComputed('2026-08-02', [itemComputed({ _heMin: 100 })]),
    ];
    const meta = calcularVisaoGeral(dias, 300).indicadores.find((i) => i.chave === 'dias_acima_meta');
    expect(meta?.valor).toBe(1);
  });

  it('acompanha todo indicador de explicação de como foi calculado e por que aparece', () => {
    const v = calcularVisaoGeral([diaComputed('2026-08-01', [itemComputed({})])], 0);
    for (const ind of v.indicadores) {
      expect(ind.comoFoiCalculado.length).toBeGreaterThan(20);
      expect(ind.porqueAparece.length).toBeGreaterThan(20);
    }
  });
});

describe('analyticsService.calcularEvolucaoDiaria', () => {
  it('não interpola dias sem dado — dia não processado simplesmente não existe na série', () => {
    // Preencher com zero faria parecer que houve operação sem hora extra.
    const serie = calcularEvolucaoDiaria([
      diaComputed('2026-08-01', [itemComputed({ _heMin: 60 })]),
      diaComputed('2026-08-05', [itemComputed({ _heMin: 90 })]),
    ]);
    expect(serie).toHaveLength(2);
    expect(serie.map((p) => p.chave)).toEqual(['2026-08-01', '2026-08-05']);
  });

  it('ordena a série cronologicamente, independente da ordem de entrada', () => {
    const serie = calcularEvolucaoDiaria([
      diaComputed('2026-08-05', [itemComputed({})]),
      diaComputed('2026-08-01', [itemComputed({})]),
    ]);
    expect(serie[0].chave).toBe('2026-08-01');
  });
});

describe('analyticsService.calcularPorSetor', () => {
  it('marca o agrupamento "Dentro do padrão" como sintético e zera suas divergências', () => {
    // Ele recebe a parcela dentro do padrão de casos acima do padrão; contá-las como
    // divergência atribuiria o problema justamente ao balde da rotina normal.
    const dias = [
      diaComputed('2026-08-01', [
        itemComputed({ _key: 'A', _padraoStatus: 'acima', _status: 'forte', _excedenteMin: 40, _heMin: 100, _setor: 'Operacional' }),
      ]),
    ];
    const setores = calcularPorSetor(dias);
    const sintetico = setores.find((s) => s.sintetico);
    expect(sintetico).toBeDefined();
    expect(sintetico?.divergencias).toBe(0);
    expect(setores.find((s) => s.setor === 'Operacional')?.divergencias).toBe(1);
  });
});

describe('analyticsService.calcularPorUnidade', () => {
  const dias = [
    diaComputed('2026-08-01', [
      itemComputed({ _key: 'ANA LIMA', motorista: 'Ana Lima' }),
      itemComputed({ _key: 'BRUNO SA', motorista: 'Bruno Sá' }),
    ]),
  ];
  const unidades: Unit[] = [{ id: 'u1', nome: 'Matriz', codigo: 'M1', localizacao: '' }];
  const colaboradores: Employee[] = [
    { id: 'c1', nome: 'Ana Lima', matricula: '1', cargo: '', setorId: null, unidadeId: 'u1', status: 'ativo', escalaId: null },
  ];

  it('vincula pelo nome normalizado e agrupa na unidade do cadastro', () => {
    const r = calcularPorUnidade(dias, colaboradores, unidades);
    expect(r.find((u) => u.unidade === 'Matriz')?.registros).toBe(1);
  });

  it('mantém visível quem não casou com o cadastro em vez de distribuir entre as unidades', () => {
    // Distribuir silenciosamente inflaria as unidades reais e esconderia a lacuna de cadastro.
    const r = calcularPorUnidade(dias, colaboradores, unidades);
    expect(r.find((u) => u.unidade === UNIDADE_NAO_VINCULADA)?.registros).toBe(1);
  });
});

describe('analyticsService.calcularPrincipaisCausas', () => {
  it('conta apenas casos fora do padrão e rotula os sem causa como Não classificada', () => {
    const dias = [
      diaComputed('2026-08-01', [
        itemComputed({ _key: 'A', _padraoStatus: 'acima', _causa: 'Rastreador com defeito' }),
        itemComputed({ _key: 'B', _padraoStatus: 'acima', _causa: '' }),
        itemComputed({ _key: 'C', _padraoStatus: 'dentro', _causa: 'Irrelevante' }),
      ]),
    ];
    const causas = calcularPrincipaisCausas(dias);
    expect(causas.find((c) => c.label === 'Irrelevante')).toBeUndefined();
    expect(causas.find((c) => c.label === 'Não classificada')?.valor).toBe(1);
  });
});

describe('analyticsService.calcularIndicadoresPendencias', () => {
  it('devolve null nos indicadores derivados quando não há base para calcular', () => {
    const r = calcularIndicadoresPendencias([pendencia({ prazo: null })], 1, HOJE);
    expect(r.aderenciaPrazoPct).toBeNull();
    expect(r.taxaAprovacaoPct).toBeNull();
    expect(r.tempoMedioResolucaoDias).toBeNull();
  });

  it('calcula taxa de aprovação apenas sobre as pendências revisadas', () => {
    // Resolvidas ainda não revisadas não entram no denominador.
    const r = calcularIndicadoresPendencias(
      [
        pendencia({ id: '1', status: 'aprovado' }),
        pendencia({ id: '2', status: 'reprovado' }),
        pendencia({ id: '3', status: 'justificado' }),
      ],
      1,
      HOJE,
    );
    expect(r.taxaAprovacaoPct).toBe(50);
    expect(r.aguardandoRevisao).toBe(1);
  });

  it('conta vencidas apenas entre as que continuam abertas', () => {
    const r = calcularIndicadoresPendencias(
      [
        pendencia({ id: '1', status: 'divergencia', prazo: '2026-08-01' }),
        pendencia({ id: '2', status: 'justificado', prazo: '2026-08-01', resolvidaEm: '2026-08-10T00:00:00.000Z' }),
      ],
      1,
      HOJE,
    );
    expect(r.vencidas).toBe(1);
  });
});

describe('analyticsService.calcularPontosDeAtencao', () => {
  it('não inventa alerta quando não há nada de errado', () => {
    const dias = [diaComputed('2026-08-01', [itemComputed({ _padraoStatus: 'dentro' })])];
    expect(calcularPontosDeAtencao(dias, [], 5, 1, HOJE)).toHaveLength(0);
  });

  it('aponta prazo vencido e leva ao Centro de Ações', () => {
    const p = [pendencia({ status: 'divergencia', prazo: '2026-08-01' })];
    const pontos = calcularPontosDeAtencao([], p, 5, 1, HOJE);
    const vencido = pontos.find((x) => x.chave === 'prazos_vencidos');
    expect(vencido?.severidade).toBe('alta');
    expect(vencido?.destino).toBe('/centro-de-acoes');
  });

  it('usa o limite de reincidência configurado, não um valor fixo', () => {
    const dias = Array.from({ length: 6 }, (_, i) =>
      diaComputed(`2026-08-0${i + 1}`, [itemComputed({ _key: 'A', _padraoStatus: 'acima' })]),
    );
    expect(calcularPontosDeAtencao(dias, [], 5, 1, HOJE).some((p) => p.chave === 'reincidentes')).toBe(true);
    expect(calcularPontosDeAtencao(dias, [], 10, 1, HOJE).some((p) => p.chave === 'reincidentes')).toBe(false);
  });
});
