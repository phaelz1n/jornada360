/* Geração e exportação de relatórios.
 *
 * Um relatório aqui é sempre uma TABELA derivada do dado que já existe: colunas + linhas, montadas
 * a partir dos mesmos services que alimentam as telas (analyticsService, scoreService,
 * pendenciaService, AuditRepository). Nenhum relatório recalcula nada por conta própria — se um
 * número aparece diferente entre a tela e o relatório, é bug, não interpretação alternativa.
 *
 * A exportação é CSV, gerada 100% no navegador (não há backend). CSV foi escolhido por ser o único
 * formato que abre no Excel, no Google Sheets e em qualquer ferramenta de BI sem depender de
 * biblioteca externa — PDF/XLSX exigiriam uma dependência nova e ficam registrados no ROADMAP.
 *
 * Escopo: todo relatório recebe já filtrado o que deve conter. Quem chama passa os dados do
 * workspace ativo e do período selecionado — este service nunca lê storage direto, então não há
 * como um relatório vazar dado de outra empresa. */
import type { HEDiaComputed } from '../engine/useHEEngineData';
import { minToStr } from '../engine/heEngineCore';
import {
  listarRegistrosAnalisados,
  calcularPorColaborador,
  calcularPorSetor,
  calcularPrincipaisCausas,
} from './analyticsService';
import { calcularScores } from './scoreService';
import { calcularEstadoSla, ESTADO_SLA_LABEL } from './slaService';
import { alertasDeJornada } from './journeyService';
import { STATUS_PENDENCIA_LABEL, PRIORIDADE_LABEL, type Pendencia } from '../domain/Pendencia';
import type { AuditEntry } from '../repositories/AuditRepository';
import type { UserAccess } from '../domain/UserAccess';

export type TipoRelatorio =
  | 'pendencias'
  | 'horas_extras'
  | 'divergencias'
  | 'colaborador'
  | 'setor'
  | 'reincidencia'
  | 'auditoria';

export interface DefinicaoRelatorio {
  tipo: TipoRelatorio;
  titulo: string;
  descricao: string;
}

export const RELATORIOS: DefinicaoRelatorio[] = [
  {
    tipo: 'pendencias',
    titulo: 'Pendências',
    descricao: 'Todas as pendências do período com status, prioridade, responsável, prazo, situação de prazo e revisão.',
  },
  {
    tipo: 'horas_extras',
    titulo: 'Horas extras',
    descricao: 'Hora extra por colaborador: total realizado, excedente sobre o padrão e dias acima do padrão.',
  },
  {
    tipo: 'divergencias',
    titulo: 'Divergências',
    descricao: 'Registros classificados como divergência ou atenção, com causa, excedente e confirmação por rastreio.',
  },
  {
    tipo: 'colaborador',
    titulo: 'Por colaborador',
    descricao: 'Score de cada colaborador com todas as dimensões avaliadas e a base de cálculo de cada uma.',
  },
  {
    tipo: 'setor',
    titulo: 'Por setor',
    descricao: 'Hora extra e divergências agrupadas por setor responsável, mais a distribuição das causas.',
  },
  {
    tipo: 'reincidencia',
    titulo: 'Reincidência',
    descricao: 'Colaboradores por número de dias acima do padrão, marcando quem passou do limite configurado.',
  },
  {
    tipo: 'auditoria',
    titulo: 'Auditoria',
    descricao: 'Trilha completa de alterações manuais: quem, quando, o que mudou e por quê.',
  },
];

export interface TabelaRelatorio {
  titulo: string;
  colunas: string[];
  linhas: (string | number)[][];
  /** Frase que descreve exatamente o recorte gerado — vai no cabeçalho do CSV e na tela. */
  escopo: string;
}

export interface ContextoRelatorio {
  nomeEmpresa: string;
  dias: HEDiaComputed[];
  pendencias: Pendencia[];
  auditoria: AuditEntry[];
  usuarios: UserAccess[];
  recurrenceLimit: number;
  alertaAntecedenciaDias: number;
  /** Descrição do período/filtros aplicados pela tela, para constar no relatório. */
  descricaoFiltro: string;
}

function nomeDoResponsavel(usuarios: UserAccess[], id: string | null): string {
  if (!id) return 'Não atribuído';
  return usuarios.find((u) => u.id === id)?.nome ?? 'Usuário removido do cadastro';
}

/* ---------------------------------------------------------------- geradores */

function relatorioPendencias(ctx: ContextoRelatorio): TabelaRelatorio {
  const hoje = new Date();
  /* O nome do colaborador não está gravado na Pendencia (só `colaboradorId`, best-effort — ver
   * BUSINESS_RULES.md). Recupera-se do dado ao vivo: o id da pendência termina em
   * `-{dateKey}-{chave do colaborador}`, então indexar por essa combinação resolve sem heurística. */
  const nomePorCaso = new Map<string, string>();
  for (const r of listarRegistrosAnalisados(ctx.dias)) {
    nomePorCaso.set(`${r.dateKey}|${r.item._key}`, r.item.motorista);
  }
  function nomeDaPendencia(p: Pendencia): string {
    const chaveColaborador = p.id.slice(p.id.indexOf(`-${p.data}-`) + p.data.length + 2);
    return nomePorCaso.get(`${p.data}|${chaveColaborador}`) ?? 'Não disponível';
  }

  return {
    titulo: 'Relatório de Pendências',
    escopo: ctx.descricaoFiltro,
    colunas: [
      'Data',
      'Colaborador',
      'Status',
      'Prioridade',
      'Categoria',
      'Responsável',
      'Prazo',
      'Situação do prazo',
      'Resolvida em',
      'Resolução',
      'Revisada por',
      'Observação da revisão',
    ],
    linhas: ctx.pendencias.map((p) => {
      return [
        p.data,
        nomeDaPendencia(p),
        STATUS_PENDENCIA_LABEL[p.status],
        PRIORIDADE_LABEL[p.prioridade],
        p.categoria,
        nomeDoResponsavel(ctx.usuarios, p.responsavelId),
        p.prazo ?? 'Sem prazo',
        ESTADO_SLA_LABEL[calcularEstadoSla(p, ctx.alertaAntecedenciaDias, hoje)],
        p.resolvidaEm ? p.resolvidaEm.slice(0, 10) : 'Em aberto',
        p.resolucao ?? '',
        p.revisadoPor ?? 'Não revisada',
        p.observacaoRevisao ?? '',
      ];
    }),
  };
}

function relatorioHorasExtras(ctx: ContextoRelatorio): TabelaRelatorio {
  const colaboradores = calcularPorColaborador(ctx.dias, ctx.recurrenceLimit);
  return {
    titulo: 'Relatório de Horas Extras',
    escopo: ctx.descricaoFiltro,
    colunas: ['Colaborador', 'Setor mais frequente', 'Dias analisados', 'Dias acima do padrão', 'HE1 total', 'Excedente sobre o padrão'],
    linhas: colaboradores.map((c) => [
      c.nome,
      c.setorMaisComum,
      c.diasAnalisados,
      c.diasAcimaPadrao,
      minToStr(c.heTotalMin),
      minToStr(c.excedenteTotalMin),
    ]),
  };
}

function relatorioDivergencias(ctx: ContextoRelatorio): TabelaRelatorio {
  const registros = listarRegistrosAnalisados(ctx.dias).filter((r) => r.status === 'divergencia' || r.status === 'atencao');
  return {
    titulo: 'Relatório de Divergências',
    escopo: ctx.descricaoFiltro,
    colunas: ['Data', 'Colaborador', 'Situação', 'HE1', 'Excedente', 'Confirmação por rastreio', 'Causa', 'Setor', 'Alerta de jornada', 'Detalhe'],
    linhas: registros.map((r) => [
      r.dateLabel,
      r.item.motorista,
      STATUS_PENDENCIA_LABEL[r.status],
      minToStr(r.item._heMin),
      r.item._padraoStatus === 'acima' ? minToStr(r.item._excedenteMin) : '—',
      r.item.confirmadas || 'Sem rastreio',
      r.item._causa || 'Não classificada',
      r.item._setor || 'Sem setor',
      alertasDeJornada(r.item).map((a) => a.descricao).join(' | ') || 'Nenhum',
      r.item.detalhe || '',
    ]),
  };
}

function relatorioColaborador(ctx: ContextoRelatorio): TabelaRelatorio {
  const scores = calcularScores(ctx.dias, ctx.recurrenceLimit);
  return {
    titulo: 'Relatório por Colaborador',
    escopo: ctx.descricaoFiltro,
    colunas: [
      'Colaborador',
      'Setor mais frequente',
      'Dias analisados',
      'Score geral',
      'Conformidade com o padrão',
      'Registros completos',
      'Regularidade de jornada',
      'Confirmação por rastreio',
      'Tratamento das ocorrências',
      'Acima do limite de reincidência',
    ],
    linhas: scores.map((s) => {
      const dim = (chave: string) => {
        const d = s.dimensoes.find((x) => x.chave === chave);
        return d?.valor === null || d === undefined ? 'Não avaliada' : `${d.valor}%`;
      };
      return [
        s.motorista,
        s.setorMaisComum,
        s.diasAnalisados,
        s.scoreGeral === null ? 'Não avaliado' : `${s.scoreGeral}%`,
        dim('conformidade'),
        dim('registros_completos'),
        dim('regularidade_jornada'),
        dim('confirmacao_rastreio'),
        dim('tratamento'),
        s.reincidenteCritico ? 'Sim' : 'Não',
      ];
    }),
  };
}

function relatorioSetor(ctx: ContextoRelatorio): TabelaRelatorio {
  const setores = calcularPorSetor(ctx.dias);
  const causas = calcularPrincipaisCausas(ctx.dias);
  const linhas: (string | number)[][] = setores.map((s) => ['Setor', s.setor, minToStr(s.heTotalMin), s.casos, s.divergencias]);
  /* As causas entram no mesmo arquivo, marcadas na primeira coluna — separar em dois relatórios
   * obrigaria a exportar duas vezes para responder a mesma pergunta ("de onde vem a hora extra"). */
  for (const c of causas) linhas.push(['Causa', c.label, '—', c.valor, `${c.pct}%`]);
  return {
    titulo: 'Relatório por Setor',
    escopo: ctx.descricaoFiltro,
    colunas: ['Tipo', 'Nome', 'HE1 total', 'Casos', 'Divergências / % do total'],
    linhas,
  };
}

function relatorioReincidencia(ctx: ContextoRelatorio): TabelaRelatorio {
  const colaboradores = calcularPorColaborador(ctx.dias, ctx.recurrenceLimit)
    .filter((c) => c.diasAcimaPadrao > 0)
    .sort((a, b) => b.diasAcimaPadrao - a.diasAcimaPadrao);
  return {
    titulo: 'Relatório de Reincidência',
    escopo: `${ctx.descricaoFiltro} · Limite configurado: ${ctx.recurrenceLimit} dia(s) acima do padrão`,
    colunas: ['Colaborador', 'Setor mais frequente', 'Dias acima do padrão', 'Dias analisados', 'Excedente acumulado', 'Acima do limite configurado'],
    linhas: colaboradores.map((c) => [
      c.nome,
      c.setorMaisComum,
      c.diasAcimaPadrao,
      c.diasAnalisados,
      minToStr(c.excedenteTotalMin),
      c.reincidenteCritico ? 'Sim' : 'Não',
    ]),
  };
}

function relatorioAuditoria(ctx: ContextoRelatorio): TabelaRelatorio {
  return {
    titulo: 'Relatório de Auditoria',
    escopo: ctx.descricaoFiltro,
    colunas: ['Quando', 'Usuário', 'Entidade', 'Ação', 'Valor anterior', 'Valor novo', 'Motivo'],
    linhas: ctx.auditoria.map((a) => [a.timestamp, a.usuario, a.entidade, a.acao, a.valorAnterior, a.valorNovo, a.motivo]),
  };
}

const GERADORES: Record<TipoRelatorio, (ctx: ContextoRelatorio) => TabelaRelatorio> = {
  pendencias: relatorioPendencias,
  horas_extras: relatorioHorasExtras,
  divergencias: relatorioDivergencias,
  colaborador: relatorioColaborador,
  setor: relatorioSetor,
  reincidencia: relatorioReincidencia,
  auditoria: relatorioAuditoria,
};

export function gerarRelatorio(tipo: TipoRelatorio, ctx: ContextoRelatorio): TabelaRelatorio {
  return GERADORES[tipo](ctx);
}

/* ---------------------------------------------------------------- exportação CSV */

/* Escape conforme RFC 4180: aspas duplicadas, e o campo inteiro entre aspas quando contém
 * separador, aspas ou quebra de linha. Sem isso, uma justificativa com vírgula quebraria a coluna. */
function campoCsv(valor: string | number): string {
  const s = String(valor ?? '');
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/* Ponto e vírgula como separador: é o que o Excel em português espera por padrão. Com vírgula, o
 * Excel pt-BR joga a linha inteira numa célula só. */
const SEPARADOR = ';';

export function tabelaParaCsv(tabela: TabelaRelatorio, nomeEmpresa: string): string {
  const cabecalho = [
    [`Jornada360 — ${tabela.titulo}`],
    [`Empresa: ${nomeEmpresa}`],
    [`Escopo: ${tabela.escopo}`],
    [`Gerado em: ${new Date().toLocaleString('pt-BR')}`],
    [],
  ];
  const corpo = [tabela.colunas, ...tabela.linhas];
  return [...cabecalho, ...corpo].map((linha) => linha.map(campoCsv).join(SEPARADOR)).join('\r\n');
}

export function nomeArquivoCsv(tipo: TipoRelatorio, nomeEmpresa: string): string {
  const empresa = nomeEmpresa
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'empresa';
  return `jornada360-${tipo}-${empresa}-${new Date().toISOString().slice(0, 10)}.csv`;
}

/* BOM UTF-8 no início: sem ele o Excel no Windows abre acentuação corrompida. */
export function baixarCsv(conteudo: string, nomeArquivo: string): void {
  const blob = new Blob([`﻿${conteudo}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
