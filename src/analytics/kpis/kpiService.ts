/* Serviço de KPIs e Indicadores Executivos (Camada Gold).
 *
 * Princípio: Funções analíticas puras para sintetizar a saúde operacional do workspace,
 * conformidade com a CLT, volume de divergências e performance de atendimento (SLA).
 */
import type { HEDiaComputed, HEItemComputed } from '../../engine/useHEEngineData';
import { statusDoCaso } from '../../services/pendingClassificationService';
import { estadoResolvido } from '../../services/pendenciaService';
import { calcularEstadoSla, type EstadoSla } from '../../services/slaService';
import { temAlertaDeJornada } from '../../services/journeyService';
import type { Pendencia, StatusPendencia } from '../../domain/Pendencia';
import { STATUS_PENDENCIA_LABEL } from '../../domain/Pendencia';
import type { IndicadorExplicado, VisaoGeral, IndicadoresPendencias, PontoDeAtencao } from '../types';
import { calcularPorColaborador } from '../segments/segmentService';

export function pct(parte: number, total: number): number {
  return total > 0 ? Math.round((parte / total) * 1000) / 10 : 0;
}

export function todosOsItens(dias: HEDiaComputed[]): HEItemComputed[] {
  return dias.flatMap((d) => d.items);
}

export function registroCompleto(item: HEItemComputed): boolean {
  return item._padraoStatus === 'acima' || item._padraoStatus === 'dentro';
}

export function ehDivergencia(item: HEItemComputed): boolean {
  const s = statusDoCaso(item);
  return s === 'divergencia' || s === 'atencao';
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

export const ROTULO_SLA: Record<EstadoSla, string> = {
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
