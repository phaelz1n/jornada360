/* Indicadores operacionais do Jornada360 (Bloco Analítico).
 *
 * PRINCÍPIO DESTE ARQUIVO: todo indicador aqui é derivado de dado que JÁ existe — os dias
 * processados pelo motor (`HEDiaComputed[]`), as Pendencias persistidas e o cadastro do workspace.
 * Nada é estimado, projetado ou preenchido por heurística. Quando um indicador não pode ser
 * calculado com o dado disponível, ele é devolvido como `null`/lista vazia e a tela mostra
 * "não disponível" — nunca um número inventado (ver `IndicadorExplicado.disponivel`).
 *
 * Nada aqui recalcula HE, padrão, excedente ou status: isso continua sendo do motor +
 * toleranceService + pendingClassificationService. Este service só AGREGA o que já foi decidido.
 *
 * Cada indicador relevante carrega sua própria explicação (`comoFoiCalculado` / `porqueAparece`),
 * exibida na interface — o usuário nunca vê um número sem poder descobrir de onde ele veio. */
import type { HEDiaComputed, HEItemComputed } from '../engine/useHEEngineData';
import { agregarPorMotorista, agregarPorSetor, SETOR_DENTRO_DO_PADRAO, type RegistroReal } from '../engine/heAggregations';
import { normName } from '../engine/heEngineCore';
import { statusDoCaso } from './pendingClassificationService';
import { estadoResolvido } from './pendenciaService';
import { calcularEstadoSla, type EstadoSla } from './slaService';
import { temAlertaDeJornada } from './journeyService';
import type { Pendencia, StatusPendencia } from '../domain/Pendencia';
import { STATUS_PENDENCIA_LABEL } from '../domain/Pendencia';
import type { Employee } from '../domain/Employee';
import type { Unit } from '../domain/Unit';

/* ---------------------------------------------------------------- tipos de saída */

export interface IndicadorExplicado {
  chave: string;
  label: string;
  /** null = não há dado suficiente para calcular. A tela mostra "—", nunca 0 como se fosse medido. */
  valor: number | null;
  /** Como o valor deve ser lido na tela. */
  formato: 'inteiro' | 'percentual' | 'minutos';
  comoFoiCalculado: string;
  porqueAparece: string;
  /** false quando falta configuração/dado — a tela explica o que precisa ser feito. */
  disponivel: boolean;
  /** Preenchido quando `disponivel` é false: o que falta para o indicador existir. */
  motivoIndisponivel?: string;
}

export interface LinhaRanking {
  chave: string;
  label: string;
  sublabel: string;
  valor: number;
  valorSecundario: number;
}

export interface PontoTemporal {
  chave: string;
  label: string;
  heTotalMin: number;
  divergencias: number;
  registros: number;
  conformidadePct: number;
}

export interface ContagemRotulada {
  label: string;
  valor: number;
  pct: number;
}

/* ---------------------------------------------------------------- helpers internos */

function pct(parte: number, total: number): number {
  return total > 0 ? Math.round((parte / total) * 1000) / 10 : 0;
}

function todosOsItens(dias: HEDiaComputed[]): HEItemComputed[] {
  return dias.flatMap((d) => d.items);
}

/* Um registro é "completo" quando o motor conseguiu comparar a jornada contra um padrão cadastrado.
 * `sem_cadastro`/`invalido` significam exatamente que faltou cadastro ou que o cadastro não era
 * legível — é a única definição de incompletude que o dado atual suporta. Não se conta batida
 * faltando individualmente: o motor não expõe isso de forma estruturada (só dentro do texto de
 * `detalhe`), e extrair por parsing de texto seria frágil e inventado. */
function registroCompleto(item: HEItemComputed): boolean {
  return item._padraoStatus === 'acima' || item._padraoStatus === 'dentro';
}

function ehDivergencia(item: HEItemComputed): boolean {
  const s = statusDoCaso(item);
  return s === 'divergencia' || s === 'atencao';
}

/* ---------------------------------------------------------------- registros analisados */

export interface RegistroAnalisado {
  dateKey: string;
  dateLabel: string;
  item: HEItemComputed;
  /** Mesma taxonomia unificada usada em Pendências e no Centro de Ações (Etapa 1). */
  status: StatusPendencia;
  temAlertaJornada: boolean;
}

/* Lista achatada de registros (um por colaborador/dia), já com o status unificado resolvido.
 * É por aqui que as telas de listagem leem os registros — nenhuma chama `flattenRegistros` do
 * engine diretamente, e nenhuma reimplementa a classificação de status. */
export function listarRegistrosAnalisados(dias: HEDiaComputed[]): RegistroAnalisado[] {
  const out: RegistroAnalisado[] = [];
  for (const dia of dias) {
    for (const item of dia.items) {
      out.push({
        dateKey: dia.dateKey,
        dateLabel: dia.dateLabel,
        item,
        status: statusDoCaso(item),
        temAlertaJornada: temAlertaDeJornada(item),
      });
    }
  }
  return out.sort((a, b) => b.dateKey.localeCompare(a.dateKey) || b.item._heMin - a.item._heMin);
}

/* ---------------------------------------------------------------- visão geral do workspace */

export interface VisaoGeral {
  diasProcessados: number;
  registrosAnalisados: number;
  colaboradoresDistintos: number;
  primeiroDia: string | null;
  ultimoDia: string | null;
  indicadores: IndicadorExplicado[];
}

export function calcularVisaoGeral(dias: HEDiaComputed[], dailyGoalMin: number): VisaoGeral {
  const itens = todosOsItens(dias);
  const total = itens.length;
  const chaves = [...dias].map((d) => d.dateKey).sort();

  const semDivergencia = itens.filter((i) => !ehDivergencia(i)).length;
  const completos = itens.filter(registroCompleto).length;
  const comAlertaJornada = itens.filter(temAlertaDeJornada).length;
  const heTotal = itens.reduce((s, i) => s + i._heMin, 0);
  const excedenteTotal = itens.filter((i) => i._padraoStatus === 'acima').reduce((s, i) => s + i._excedenteMin, 0);
  const diasAcimaMeta = dailyGoalMin > 0 ? dias.filter((d) => d.totalHEAtual > dailyGoalMin).length : 0;

  const indicadores: IndicadorExplicado[] = [
    {
      chave: 'jornadas_sem_divergencia',
      label: 'Jornadas sem divergência',
      valor: total ? pct(semDivergencia, total) : null,
      formato: 'percentual',
      disponivel: total > 0,
      motivoIndisponivel: total ? undefined : 'Nenhum dia foi processado ainda no Assistente HE Diário.',
      comoFoiCalculado:
        'Registros cujo status não é "Divergência" nem "Atenção", divididos pelo total de registros analisados. O status vem da mesma classificação usada em Pendências — não é recalculado aqui.',
      porqueAparece:
        'É o indicador mais direto de saúde da operação: quanto maior, menos casos exigiram decisão humana no período.',
    },
    {
      chave: 'registros_completos',
      label: 'Registros completos',
      valor: total ? pct(completos, total) : null,
      formato: 'percentual',
      disponivel: total > 0,
      motivoIndisponivel: total ? undefined : 'Nenhum dia foi processado ainda.',
      comoFoiCalculado:
        'Registros em que havia horário padrão cadastrado e legível para comparar (status do padrão "acima" ou "dentro"), divididos pelo total. Os demais ficaram "sem cadastro" ou "inválido".',
      porqueAparece:
        'Mede a qualidade do cadastro, não a do colaborador: um percentual baixo significa que faltam horários padrão em Configurações → Escalas, e sem eles o sistema não consegue julgar a jornada.',
    },
    {
      chave: 'he_total',
      label: 'HE1 acumulada no período',
      valor: total ? heTotal : null,
      formato: 'minutos',
      disponivel: total > 0,
      motivoIndisponivel: total ? undefined : 'Nenhum dia foi processado ainda.',
      comoFoiCalculado:
        'Soma da HE1 efetiva de todos os registros do período. HE corrigida manualmente na ficha substitui a original, como no motor.',
      porqueAparece: 'É o volume bruto de hora extra que a operação gerou — a base de custo do período.',
    },
    {
      chave: 'excedente_total',
      label: 'Excedente sobre o padrão',
      valor: total ? excedenteTotal : null,
      formato: 'minutos',
      disponivel: total > 0,
      motivoIndisponivel: total ? undefined : 'Nenhum dia foi processado ainda.',
      comoFoiCalculado:
        'Soma do excedente (HE realizada − HE programada) apenas dos registros classificados como acima do padrão, respeitando a tolerância configurada no workspace.',
      porqueAparece:
        'Separa a hora extra prevista da não prevista. É esta parcela — não a HE total — que representa desvio em relação ao que foi planejado.',
    },
    {
      chave: 'alertas_jornada',
      label: 'Alertas de jornada',
      valor: total ? comAlertaJornada : null,
      formato: 'inteiro',
      disponivel: total > 0,
      motivoIndisponivel: total ? undefined : 'Nenhum dia foi processado ainda.',
      comoFoiCalculado:
        'Registros em que o motor detectou descanso entre jornadas ou pausa dentro da jornada abaixo do mínimo configurado em Configurações → Regras.',
      porqueAparece:
        'É risco trabalhista direto, independente de hora extra: uma jornada pode estar dentro do padrão de HE e ainda assim violar o descanso mínimo.',
    },
    {
      chave: 'dias_acima_meta',
      label: 'Dias acima da meta',
      valor: dailyGoalMin > 0 ? diasAcimaMeta : null,
      formato: 'inteiro',
      disponivel: dailyGoalMin > 0 && dias.length > 0,
      motivoIndisponivel:
        dailyGoalMin > 0
          ? dias.length
            ? undefined
            : 'Nenhum dia foi processado ainda.'
          : 'A meta diária de HE1 ainda não foi definida em Configurações → Regras.',
      comoFoiCalculado:
        'Dias em que a HE1 total do dia (somando todos os colaboradores) passou da meta diária configurada no workspace.',
      porqueAparece:
        'Compara a operação com o alvo que a própria empresa definiu. Sem meta configurada o indicador não aparece — o sistema não assume a meta de nenhuma empresa.',
    },
  ];

  return {
    diasProcessados: dias.length,
    registrosAnalisados: total,
    colaboradoresDistintos: new Set(itens.map((i) => i._key)).size,
    primeiroDia: chaves[0] ?? null,
    ultimoDia: chaves[chaves.length - 1] ?? null,
    indicadores,
  };
}

/* ---------------------------------------------------------------- evolução temporal */

/* Série diária, ordenada crescente. Um ponto por dia processado — não há interpolação de dias sem
 * dado: dia que não foi processado simplesmente não existe na série (em vez de aparecer como zero,
 * o que faria parecer que houve operação sem HE). */
export function calcularEvolucaoDiaria(dias: HEDiaComputed[]): PontoTemporal[] {
  return [...dias]
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    .map((d) => {
      const divergencias = d.items.filter(ehDivergencia).length;
      return {
        chave: d.dateKey,
        label: d.dateLabel,
        heTotalMin: d.totalHEAtual,
        divergencias,
        registros: d.items.length,
        conformidadePct: pct(d.items.length - divergencias, d.items.length),
      };
    });
}

/* Mesma série, agrupada por mês — útil quando o período analisado passa de algumas semanas. */
export function calcularEvolucaoMensal(dias: HEDiaComputed[]): PontoTemporal[] {
  const map = new Map<string, { he: number; div: number; reg: number }>();
  for (const d of dias) {
    const mk = d.dateKey.slice(0, 7);
    const acc = map.get(mk) || { he: 0, div: 0, reg: 0 };
    acc.he += d.totalHEAtual;
    acc.div += d.items.filter(ehDivergencia).length;
    acc.reg += d.items.length;
    map.set(mk, acc);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([mk, a]) => {
      const [ano, mes] = mk.split('-');
      return {
        chave: mk,
        label: `${mes}/${ano}`,
        heTotalMin: a.he,
        divergencias: a.div,
        registros: a.reg,
        conformidadePct: pct(a.reg - a.div, a.reg),
      };
    });
}

/* ---------------------------------------------------------------- por colaborador */

export interface IndicadorColaborador {
  chave: string;
  nome: string;
  setorMaisComum: string;
  diasAnalisados: number;
  diasAcimaPadrao: number;
  heTotalMin: number;
  excedenteTotalMin: number;
  conformidadePct: number;
  reincidenteCritico: boolean;
  alertasJornada: number;
}

export function calcularPorColaborador(dias: HEDiaComputed[], recurrenceLimit: number): IndicadorColaborador[] {
  const alertasPorChave = new Map<string, number>();
  for (const item of todosOsItens(dias)) {
    if (temAlertaDeJornada(item)) alertasPorChave.set(item._key, (alertasPorChave.get(item._key) || 0) + 1);
  }
  return agregarPorMotorista(dias)
    .map((m) => ({
      chave: m.key,
      nome: m.motorista,
      setorMaisComum: m.setorMaisComum,
      diasAnalisados: m.diasAnalisados,
      diasAcimaPadrao: m.diasAcimaPadrao,
      heTotalMin: m.heTotalMin,
      excedenteTotalMin: m.excedenteTotalMin,
      conformidadePct: pct(m.diasAnalisados - m.diasAcimaPadrao, m.diasAnalisados),
      reincidenteCritico: m.diasAcimaPadrao > recurrenceLimit,
      alertasJornada: alertasPorChave.get(m.key) || 0,
    }))
    .sort((a, b) => b.excedenteTotalMin - a.excedenteTotalMin);
}

/* ---------------------------------------------------------------- por setor */

export interface IndicadorSetor {
  setor: string;
  heTotalMin: number;
  casos: number;
  divergencias: number;
  registros: RegistroReal[];
  /** true para o agrupamento sintético "Dentro do padrão", que não é um setor da empresa. */
  sintetico: boolean;
}

/* Reaproveita `agregarPorSetor` (a mesma regra de rateio já usada em Análise por Setor: quando o
 * caso passou do padrão só o EXCEDENTE vai pro setor marcado, o resto vai pra "Dentro do padrão") —
 * não existe uma segunda definição de "HE do setor" no sistema. */
export function calcularPorSetor(dias: HEDiaComputed[]): IndicadorSetor[] {
  return agregarPorSetor(dias).map((s) => {
    const sintetico = s.setor === SETOR_DENTRO_DO_PADRAO;
    return {
      setor: s.setor,
      heTotalMin: s.heTotalMin,
      casos: s.casos,
      /* No agrupamento sintético a contagem de divergência não significa nada: um caso acima do
       * padrão entra ali com a PARCELA dentro do padrão dele, então contá-lo como divergência
       * desse "setor" atribuiria o problema justamente ao balde que representa a rotina normal. */
      divergencias: sintetico ? 0 : s.registros.filter((r) => ehDivergencia(r.item)).length,
      registros: s.registros,
      sintetico,
    };
  });
}

/* ---------------------------------------------------------------- por unidade */

export interface IndicadorUnidade {
  unidadeId: string | null;
  unidade: string;
  colaboradores: number;
  registros: number;
  heTotalMin: number;
  excedenteTotalMin: number;
  divergencias: number;
  conformidadePct: number;
}

export const UNIDADE_NAO_VINCULADA = 'Sem vínculo com o cadastro';

/* Indicadores por unidade dependem de um vínculo que o motor NÃO fornece: a planilha de ponto traz
 * o nome do colaborador, não a unidade. O vínculo é feito por nome normalizado contra o cadastro de
 * Colaboradores (mesma regra best-effort de `pendenciaService.vincularColaborador`).
 *
 * Quem não casa com o cadastro cai em UNIDADE_NAO_VINCULADA — visível de propósito: é a forma
 * honesta de mostrar que o recorte por unidade só é confiável na medida em que o cadastro estiver
 * completo, em vez de distribuir esses registros silenciosamente entre as unidades reais. */
export function calcularPorUnidade(
  dias: HEDiaComputed[],
  colaboradores: Employee[],
  unidades: Unit[],
): IndicadorUnidade[] {
  const porNome = new Map<string, Employee>();
  for (const e of colaboradores) porNome.set(normName(e.nome), e);
  const nomeUnidade = new Map<string, string>();
  for (const u of unidades) nomeUnidade.set(u.id, u.nome);

  const acc = new Map<string, { unidadeId: string | null; chaves: Set<string>; registros: number; he: number; exc: number; div: number }>();

  for (const item of todosOsItens(dias)) {
    const emp = porNome.get(normName(item.motorista));
    const unidadeId = emp?.unidadeId ?? null;
    const rotulo = unidadeId ? nomeUnidade.get(unidadeId) || 'Unidade removida do cadastro' : UNIDADE_NAO_VINCULADA;
    const a = acc.get(rotulo) || { unidadeId, chaves: new Set<string>(), registros: 0, he: 0, exc: 0, div: 0 };
    a.chaves.add(item._key);
    a.registros++;
    a.he += item._heMin;
    if (item._padraoStatus === 'acima') a.exc += item._excedenteMin;
    if (ehDivergencia(item)) a.div++;
    acc.set(rotulo, a);
  }

  return [...acc.entries()]
    .map(([unidade, a]) => ({
      unidadeId: a.unidadeId,
      unidade,
      colaboradores: a.chaves.size,
      registros: a.registros,
      heTotalMin: a.he,
      excedenteTotalMin: a.exc,
      divergencias: a.div,
      conformidadePct: pct(a.registros - a.div, a.registros),
    }))
    .sort((a, b) => b.excedenteTotalMin - a.excedenteTotalMin);
}

/* ---------------------------------------------------------------- causas */

/* Distribuição das causas prováveis. Usa `_causa` (a causa marcada por alguém na ficha, ou a
 * sugerida pelo motor quando ninguém marcou) apenas dos casos que não estão normais — a causa de um
 * caso dentro do padrão não descreve um problema. Sem causa registrada, entra como "Não classificada"
 * em vez de ser omitido: saber quanto do total está sem classificação é parte do diagnóstico. */
export function calcularPrincipaisCausas(dias: HEDiaComputed[]): ContagemRotulada[] {
  const map = new Map<string, number>();
  let total = 0;
  for (const item of todosOsItens(dias)) {
    if (item._padraoStatus === 'dentro') continue;
    const causa = item._causa?.trim() || 'Não classificada';
    map.set(causa, (map.get(causa) || 0) + 1);
    total++;
  }
  return [...map.entries()]
    .map(([label, valor]) => ({ label, valor, pct: pct(valor, total) }))
    .sort((a, b) => b.valor - a.valor);
}

/* ---------------------------------------------------------------- pendências, SLA, revisão */

export interface IndicadoresPendencias {
  total: number;
  abertas: number;
  resolvidas: number;
  porStatus: ContagemRotulada[];
  porSla: ContagemRotulada[];
  aprovadas: number;
  reprovadas: number;
  aguardandoRevisao: number;
  vencidas: number;
  semPrazo: number;
  semResponsavel: number;
  /** null quando nenhuma pendência resolvida tinha prazo definido — não dá para medir aderência. */
  aderenciaPrazoPct: number | null;
  /** null quando nenhuma foi revisada ainda. */
  taxaAprovacaoPct: number | null;
  /** null quando nenhuma pendência foi resolvida ainda. */
  tempoMedioResolucaoDias: number | null;
}

const ROTULO_SLA: Record<EstadoSla, string> = {
  sem_prazo: 'Sem prazo definido',
  dentro_prazo: 'Dentro do prazo',
  proximo_vencimento: 'Prazo próximo',
  vencido: 'Prazo vencido',
  resolvida_dentro_prazo: 'Resolvida dentro do prazo',
  resolvida_fora_prazo: 'Resolvida fora do prazo',
};

export function calcularIndicadoresPendencias(
  pendencias: Pendencia[],
  alertaAntecedenciaDias: number,
  hoje: Date = new Date(),
): IndicadoresPendencias {
  const total = pendencias.length;
  const statusMap = new Map<StatusPendencia, number>();
  const slaMap = new Map<EstadoSla, number>();

  let abertas = 0;
  let resolvidas = 0;
  let aprovadas = 0;
  let reprovadas = 0;
  let aguardandoRevisao = 0;
  let vencidas = 0;
  let semPrazo = 0;
  let semResponsavel = 0;
  let resolvidasComPrazo = 0;
  let resolvidasDentroDoPrazo = 0;
  let somaDiasResolucao = 0;
  let resolvidasComData = 0;

  for (const p of pendencias) {
    statusMap.set(p.status, (statusMap.get(p.status) || 0) + 1);

    const sla = calcularEstadoSla(p, alertaAntecedenciaDias, hoje);
    slaMap.set(sla, (slaMap.get(sla) || 0) + 1);
    if (sla === 'vencido') vencidas++;
    if (sla === 'resolvida_dentro_prazo' || sla === 'resolvida_fora_prazo') {
      resolvidasComPrazo++;
      if (sla === 'resolvida_dentro_prazo') resolvidasDentroDoPrazo++;
    }

    if (!p.prazo) semPrazo++;
    if (!p.responsavelId) semResponsavel++;

    if (estadoResolvido(p.status)) {
      resolvidas++;
      if (p.status === 'aprovado') aprovadas++;
      else if (p.status === 'reprovado') reprovadas++;
      else aguardandoRevisao++;

      if (p.resolvidaEm) {
        const dias = (new Date(p.resolvidaEm).getTime() - new Date(p.criadaEm).getTime()) / 86_400_000;
        if (dias >= 0) {
          somaDiasResolucao += dias;
          resolvidasComData++;
        }
      }
    } else {
      abertas++;
    }
  }

  const revisadas = aprovadas + reprovadas;

  return {
    total,
    abertas,
    resolvidas,
    porStatus: [...statusMap.entries()]
      .map(([s, v]) => ({ label: STATUS_PENDENCIA_LABEL[s], valor: v, pct: pct(v, total) }))
      .sort((a, b) => b.valor - a.valor),
    porSla: [...slaMap.entries()]
      .map(([s, v]) => ({ label: ROTULO_SLA[s], valor: v, pct: pct(v, total) }))
      .sort((a, b) => b.valor - a.valor),
    aprovadas,
    reprovadas,
    aguardandoRevisao,
    vencidas,
    semPrazo,
    semResponsavel,
    aderenciaPrazoPct: resolvidasComPrazo ? pct(resolvidasDentroDoPrazo, resolvidasComPrazo) : null,
    taxaAprovacaoPct: revisadas ? pct(aprovadas, revisadas) : null,
    tempoMedioResolucaoDias: resolvidasComData ? Math.round((somaDiasResolucao / resolvidasComData) * 10) / 10 : null,
  };
}

/* ---------------------------------------------------------------- indicadores de atenção */

export type SeveridadeAtencao = 'alta' | 'media';

export interface PontoDeAtencao {
  chave: string;
  titulo: string;
  detalhe: string;
  severidade: SeveridadeAtencao;
  /** Rota para onde a pessoa deve ir para tratar. */
  destino: string;
}

/* Lista de "o que exige atenção agora". Cada item só aparece quando o dado que o sustenta existe —
 * nenhum é gerado por limiar inventado: reincidência usa `recurrenceLimit` do workspace, prazo usa o
 * prazo que alguém definiu, cadastro incompleto usa a própria ausência de padrão cadastrado. */
export function calcularPontosDeAtencao(
  dias: HEDiaComputed[],
  pendencias: Pendencia[],
  recurrenceLimit: number,
  alertaAntecedenciaDias: number,
  hoje: Date = new Date(),
): PontoDeAtencao[] {
  const out: PontoDeAtencao[] = [];
  const itens = todosOsItens(dias);

  const vencidas = pendencias.filter((p) => calcularEstadoSla(p, alertaAntecedenciaDias, hoje) === 'vencido');
  if (vencidas.length) {
    out.push({
      chave: 'prazos_vencidos',
      titulo: `${vencidas.length} pendência(s) com prazo vencido`,
      detalhe: 'O prazo definido para tratamento já passou e o caso continua aberto.',
      severidade: 'alta',
      destino: '/centro-de-acoes',
    });
  }

  const reincidentes = calcularPorColaborador(dias, recurrenceLimit).filter((c) => c.reincidenteCritico);
  if (reincidentes.length) {
    out.push({
      chave: 'reincidentes',
      titulo: `${reincidentes.length} colaborador(es) acima do limite de reincidência`,
      detalhe: `Passaram de ${recurrenceLimit} dia(s) acima do padrão no período analisado — o limite configurado em Configurações → Regras.`,
      severidade: 'alta',
      destino: '/reincidencia',
    });
  }

  const comAlerta = itens.filter(temAlertaDeJornada).length;
  if (comAlerta) {
    out.push({
      chave: 'alertas_jornada',
      titulo: `${comAlerta} registro(s) com alerta de jornada`,
      detalhe: 'Descanso entre jornadas ou pausa dentro da jornada abaixo do mínimo configurado.',
      severidade: 'alta',
      destino: '/ponto',
    });
  }

  const semPadrao = itens.filter((i) => !registroCompleto(i)).length;
  if (semPadrao) {
    out.push({
      chave: 'sem_padrao',
      titulo: `${semPadrao} registro(s) sem horário padrão para comparar`,
      detalhe: 'Sem padrão cadastrado, o sistema não consegue dizer se a jornada foi normal. Cadastre em Configurações → Escalas.',
      severidade: 'media',
      destino: '/configuracoes',
    });
  }

  const abertasSemResponsavel = pendencias.filter((p) => !estadoResolvido(p.status) && !p.responsavelId).length;
  if (abertasSemResponsavel) {
    out.push({
      chave: 'sem_responsavel',
      titulo: `${abertasSemResponsavel} pendência(s) aberta(s) sem responsável`,
      detalhe: 'Ninguém foi designado para tratar — o caso pode ficar parado sem que alguém perceba.',
      severidade: 'media',
      destino: '/centro-de-acoes',
    });
  }

  const aguardandoRevisao = pendencias.filter((p) => p.status === 'justificado').length;
  if (aguardandoRevisao) {
    out.push({
      chave: 'aguardando_revisao',
      titulo: `${aguardandoRevisao} pendência(s) resolvida(s) aguardando revisão`,
      detalhe: 'Foram tratadas, mas ainda não passaram por aprovação ou reprovação.',
      severidade: 'media',
      destino: '/centro-de-acoes',
    });
  }

  return out;
}

/* ---------------------------------------------------------------- rankings */

export function rankingMaiorExcedente(colaboradores: IndicadorColaborador[], limite = 5): LinhaRanking[] {
  return colaboradores
    .filter((c) => c.excedenteTotalMin > 0)
    .slice(0, limite)
    .map((c) => ({
      chave: c.chave,
      label: c.nome,
      sublabel: c.setorMaisComum,
      valor: c.excedenteTotalMin,
      valorSecundario: c.diasAcimaPadrao,
    }));
}

export function rankingMenorConformidade(colaboradores: IndicadorColaborador[], limite = 5): LinhaRanking[] {
  return [...colaboradores]
    .filter((c) => c.diasAnalisados > 0 && c.conformidadePct < 100)
    .sort((a, b) => a.conformidadePct - b.conformidadePct)
    .slice(0, limite)
    .map((c) => ({
      chave: c.chave,
      label: c.nome,
      sublabel: c.setorMaisComum,
      valor: c.conformidadePct,
      valorSecundario: c.diasAnalisados,
    }));
}

export function rankingSetoresComDivergencia(setores: IndicadorSetor[], limite = 5): LinhaRanking[] {
  return [...setores]
    .filter((s) => s.divergencias > 0)
    .sort((a, b) => b.divergencias - a.divergencias)
    .slice(0, limite)
    .map((s) => ({
      chave: s.setor,
      label: s.setor,
      sublabel: `${s.casos} caso(s)`,
      valor: s.divergencias,
      valorSecundario: s.heTotalMin,
    }));
}
