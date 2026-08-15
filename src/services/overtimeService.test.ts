/* Horas extras, reincidência e relatórios — as agregações que alimentam telas e exportação.
 * Ver BUSINESS_RULES.md § Horas extras e § Reincidência. */
import { describe, it, expect, beforeEach } from 'vitest';
import { calcularHoraExtra, calcularHoraExtraDoDia, resumoPorColaborador } from './overtimeService';
import { calcularReincidencia } from './recurrenceService';
import { gerarRelatorio, tabelaParaCsv, nomeArquivoCsv, RELATORIOS } from './reportService';
import { itemComputed, itemRaw, snapshot, diaComputed, pendencia } from '../testing/fixtures';
import { TimeRecordRepository } from '../repositories/TimeRecordRepository';

function diasDe(colab: string, config: { padrao: 'acima' | 'dentro'; he: number; exc: number }[]) {
  return config.map((c, i) =>
    diaComputed(`2026-08-${String(i + 1).padStart(2, '0')}`, [
      itemComputed({ _key: colab, motorista: colab, _padraoStatus: c.padrao, _heMin: c.he, _excedenteMin: c.exc }),
    ]),
  );
}

describe('overtimeService.resumoPorColaborador', () => {
  it('soma a HE de todos os dias e o excedente só dos dias acima do padrão', () => {
    const dias = diasDe('ANA', [
      { padrao: 'acima', he: 120, exc: 60 },
      { padrao: 'dentro', he: 30, exc: -30 },
      { padrao: 'acima', he: 90, exc: 30 },
    ]);
    const [ana] = resumoPorColaborador(dias);
    expect(ana.heTotalMin).toBe(240);
    expect(ana.excedenteTotalMin).toBe(90);
    expect(ana.diasAcimaPadrao).toBe(2);
    expect(ana.diasAnalisados).toBe(3);
  });

  it('separa colaboradores diferentes', () => {
    const dias = [
      diaComputed('2026-08-01', [
        itemComputed({ _key: 'ANA', motorista: 'Ana', _heMin: 60 }),
        itemComputed({ _key: 'BRUNO', motorista: 'Bruno', _heMin: 120 }),
      ]),
    ];
    const r = resumoPorColaborador(dias);
    expect(r).toHaveLength(2);
    expect(r.find((x) => x.key === 'ANA')?.heTotalMin).toBe(60);
  });
});


/* calcularHoraExtra é a conta que a ficha de pendência mostra: programada (padrão cadastrado),
 * realizada (HE do motor, ou a corrigida à mão) e excedente (só o que passou da tolerância). */
describe('overtimeService.calcularHoraExtra', () => {
  it('usa o padrão cadastrado como programada e o HE do motor como realizada', () => {
    const r = calcularHoraExtra(itemRaw({ he1min: 90, padraoMin: 60, padraoStatus: 'acima' }), undefined, 10);
    expect(r.heProgramadaMin).toBe(60);
    expect(r.heRealizadaMin).toBe(90);
  });

  it('a HE corrigida à mão substitui a do motor no cálculo inteiro', () => {
    const item = itemRaw({ he1min: 90, padraoMin: 60, padraoStatus: 'acima' });
    const r = calcularHoraExtra(item, { heCorrigida: 65 }, 10);
    expect(r.heRealizadaMin).toBe(65);
    expect(r.dentroDoPadrao).toBe(true);
  });

  /* Excedente e "dentro do padrão" respondem a perguntas diferentes: o excedente é quanto passou
   * do padrão cadastrado; a tolerância decide só se aquilo conta como divergência. Um caso pode
   * ter excedente > 0 e ainda assim estar dentro do padrão — é o que a tolerância significa. */
  it('diferença dentro da tolerância conta como dentro do padrão, mas o excedente continua visível', () => {
    const r = calcularHoraExtra(itemRaw({ he1min: 68, padraoMin: 60 }), undefined, 10);
    expect(r.dentroDoPadrao).toBe(true);
    expect(r.heExcedenteMin).toBe(8);
  });

  it('diferença acima da tolerância sai do padrão', () => {
    const r = calcularHoraExtra(itemRaw({ he1min: 95, padraoMin: 60 }), undefined, 10);
    expect(r.dentroDoPadrao).toBe(false);
    expect(r.heExcedenteMin).toBe(35);
  });

  it('nunca devolve excedente negativo', () => {
    const r = calcularHoraExtra(itemRaw({ he1min: 10, padraoMin: 60 }), undefined, 10);
    expect(r.heExcedenteMin).toBe(0);
  });

  it('sem padrão cadastrado o excedente não é inventado', () => {
    const r = calcularHoraExtra(itemRaw({ he1min: 90, padraoMin: null, padraoStatus: 'sem_cadastro', excedenteMin: 0 }), undefined, 10);
    expect(r.heProgramadaMin).toBe(0);
    expect(r.heExcedenteMin).toBe(0);
  });
});

describe('overtimeService.calcularHoraExtraDoDia', () => {
  const ws = 'ws-he-dia';

  beforeEach(() => {
    localStorage.clear();
    TimeRecordRepository.saveSnapshot(
      ws,
      snapshot('2026-08-10', [itemRaw({ motorista: 'Ana Souza', he1min: 90, padraoMin: 60 })]),
    );
  });

  it('encontra o colaborador do dia e devolve a conta', () => {
    const r = calcularHoraExtraDoDia(ws, '2026-08-10', 'Ana Souza', 10);
    expect(r).not.toBeNull();
    expect(r!.heRealizadaMin).toBe(90);
    expect(r!.heProgramadaMin).toBe(60);
  });

  it('acha o colaborador mesmo com acento e caixa diferentes', () => {
    expect(calcularHoraExtraDoDia(ws, '2026-08-10', 'ANA SOUZÁ', 10)).not.toBeNull();
  });

  it('aplica a HE corrigida gravada no caso', () => {
    TimeRecordRepository.updateCase(ws, '2026-08-10', 'Ana Souza', { heCorrigida: 62 });
    expect(calcularHoraExtraDoDia(ws, '2026-08-10', 'Ana Souza', 10)!.heRealizadaMin).toBe(62);
  });

  it('devolve null — nunca zero — quando o colaborador não está naquele dia', () => {
    expect(calcularHoraExtraDoDia(ws, '2026-08-10', 'Outro Nome', 10)).toBeNull();
  });

  it('não enxerga o dia de outra empresa', () => {
    expect(calcularHoraExtraDoDia('outra-empresa', '2026-08-10', 'Ana Souza', 10)).toBeNull();
  });
});

describe('recurrenceService.calcularReincidencia', () => {
  it('só lista quem ficou acima do padrão ao menos uma vez', () => {
    const dias = diasDe('ANA', [{ padrao: 'dentro', he: 30, exc: 0 }]);
    expect(calcularReincidencia(dias, 5)).toHaveLength(0);
  });

  it('marca como crítico apenas acima do limite, não no limite', () => {
    const cinco = diasDe('ANA', Array.from({ length: 5 }, () => ({ padrao: 'acima' as const, he: 90, exc: 30 })));
    const seis = diasDe('ANA', Array.from({ length: 6 }, () => ({ padrao: 'acima' as const, he: 90, exc: 30 })));
    expect(calcularReincidencia(cinco, 5)[0].critico).toBe(false);
    expect(calcularReincidencia(seis, 5)[0].critico).toBe(true);
  });

  it('usa o limite configurado por empresa', () => {
    const dias = diasDe('ANA', Array.from({ length: 3 }, () => ({ padrao: 'acima' as const, he: 90, exc: 30 })));
    expect(calcularReincidencia(dias, 5)[0].critico).toBe(false);
    expect(calcularReincidencia(dias, 2)[0].critico).toBe(true);
  });
});

describe('reportService', () => {
  const ctx = {
    nomeEmpresa: 'Empresa Teste',
    dias: diasDe('ANA', [{ padrao: 'acima', he: 120, exc: 60 }]),
    pendencias: [pendencia({ data: '2026-08-01' })],
    auditoria: [],
    usuarios: [{ id: 'u1', nome: 'Administrador', papel: 'administrador' as const }],
    recurrenceLimit: 5,
    alertaAntecedenciaDias: 1,
    descricaoFiltro: 'Ago/2026',
  };

  it('gera os 7 relatórios sem quebrar', () => {
    for (const def of RELATORIOS) {
      const t = gerarRelatorio(def.tipo, ctx);
      expect(t.colunas.length).toBeGreaterThan(0);
      expect(t.titulo).toBeTruthy();
    }
  });

  it('mantém o mesmo número de colunas em todas as linhas', () => {
    // Uma linha com contagem diferente desalinharia o CSV inteiro no Excel.
    for (const def of RELATORIOS) {
      const t = gerarRelatorio(def.tipo, ctx);
      for (const linha of t.linhas) expect(linha).toHaveLength(t.colunas.length);
    }
  });

  it('escapa campos com separador, aspas e quebra de linha', () => {
    const tabela = {
      titulo: 'Teste',
      escopo: 'Escopo',
      colunas: ['A', 'B'],
      linhas: [['texto; com ponto e vírgula', 'com "aspas"']],
    };
    const csv = tabelaParaCsv(tabela, 'Empresa Teste');
    expect(csv).toContain('"texto; com ponto e vírgula"');
    expect(csv).toContain('""aspas""');
  });

  it('inclui empresa, escopo e data no cabeçalho do arquivo', () => {
    const csv = tabelaParaCsv(gerarRelatorio('horas_extras', ctx), 'Empresa Teste');
    expect(csv).toContain('Empresa: Empresa Teste');
    expect(csv).toContain('Escopo: Ago/2026');
  });

  it('gera nome de arquivo sem acento nem caractere problemático', () => {
    const nome = nomeArquivoCsv('pendencias', 'Metalúrgica Ação & Cia');
    expect(nome).toMatch(/^jornada360-pendencias-[a-z0-9-]+-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
