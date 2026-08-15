/* Explica uma Pendencia usando exclusivamente dado que o motor real + a config do workspace já
 * produziram — não recalcula divergência (reaproveita overtimeService.calcularHoraExtraDoDia, que
 * por sua vez reaproveita toleranceService), não decide nada novo, só narra em português simples o
 * que o sistema já decidiu e com quais dados. Se um dado não existe, o campo correspondente fica
 * `null` — a interface é quem decide como mostrar isso ("Não disponível"), este service nunca
 * inventa um valor pra preencher a lacuna.
 *
 * Arquitetura: Interface → (este service) → overtimeService/slaService/dados já computados por
 * useHEEngineData/pendenciaService → explicação. Nenhuma lógica de tolerância/excedente/SLA é
 * duplicada aqui — só formatada. */
import { dkToLabel, minToStr, minToStrSigned, statusLabel } from '../engine/heEngineCore';
import type { HEItemComputed } from '../engine/useHEEngineData';
import { calcularHoraExtraDoDia } from './overtimeService';
import { calcularEstadoSla, diasDeAtraso, ESTADO_SLA_LABEL, type EstadoSla } from './slaService';
import type { Pendencia } from '../domain/Pendencia';
import { PRIORIDADE_LABEL, STATUS_PENDENCIA_LABEL } from '../domain/Pendencia';
import type { UserAccess } from '../domain/UserAccess';

export interface DadoConsiderado {
  label: string;
  /** null = não existe/não foi calculado — a UI mostra "Não disponível", nunca um valor inventado. */
  valor: string | null;
}

export interface ExplicacaoPendencia {
  motivo: string;
  dadosConsiderados: DadoConsiderado[];
  /** null só quando não há nenhuma regra aplicável (ex.: sem padrão cadastrado pra comparar). */
  regraAplicada: string | null;
  resultado: string;
  evidencias: string[];
  origem: string;
  /** Fase 2, Etapa 7 — só preenchida quando o prazo explica algo relevante (vencido/próximo/
   *  resolvida fora do prazo). null quando não há prazo ou o prazo não é motivo de destaque. */
  notaPrazo: string | null;
}

const ORIGEM_LABEL: Record<Pendencia['origem'], string> = {
  motor_he: 'Assistente HE Diário (motor real de cruzamento de ponto)',
};

function motivoParaStatus(
  pendencia: Pendencia,
  item: HEItemComputed,
  toleranceMin: number,
  excedenteMin: number | null,
): string {
  const heRealizadaStr = minToStr(item._heMin);
  const confirmacao = statusLabel(item._status);

  switch (pendencia.status) {
    case 'divergencia':
      return (
        `A HE realizada (${heRealizadaStr}) ficou ${minToStrSigned(excedenteMin ?? 0)} acima da HE programada, ` +
        `ultrapassando a tolerância configurada de ${toleranceMin} min. A confirmação por rastreio classificou ` +
        `o caso como "${confirmacao}".`
      );
    case 'atencao':
      return (
        `A HE realizada (${heRealizadaStr}) excedeu a tolerância configurada de ${toleranceMin} min, mas a ` +
        `confirmação por rastreio ficou como "${confirmacao}" — um sinal mais fraco que "Diverge forte", por ` +
        `isso o caso aparece como Atenção em vez de Divergência confirmada.`
      );
    case 'pendente':
      return item._padraoStatus === 'sem_cadastro'
        ? 'Não há horário padrão cadastrado para este colaborador neste dia — sem uma referência confiável, não é possível calcular divergência. O caso foi sinalizado para revisão manual.'
        : 'O horário padrão deste dia foi marcado pelo motor como não confiável (padrão inválido) — sem uma referência confiável, não é possível calcular divergência. O caso foi sinalizado para revisão manual.';
    case 'justificado':
      return 'Caso originalmente sinalizado por excedente de HE acima da tolerância configurada e marcado como resolvido. O motivo original da sinalização continua descrito nos dados abaixo.';
    case 'aprovado':
      return 'Caso resolvido e revisado — a resolução foi aprovada. O motivo original da sinalização continua descrito nos dados abaixo.';
    case 'reprovado':
      return 'Caso resolvido e revisado — a resolução foi reprovada, e precisa de novo tratamento. O motivo original da sinalização continua descrito nos dados abaixo.';
    default:
      return 'Sem informação suficiente para explicar este caso.';
  }
}

function textoNotaPrazo(pendencia: Pendencia, estadoSla: EstadoSla): string | null {
  if (!pendencia.prazo) return null;
  if (estadoSla === 'vencido') {
    return `Prazo vencido — o prazo era ${dkToLabel(pendencia.prazo)} (${diasDeAtraso(pendencia.prazo)} dia(s) de atraso).`;
  }
  if (estadoSla === 'proximo_vencimento') {
    return `Prazo próximo do vencimento — vence em ${dkToLabel(pendencia.prazo)}.`;
  }
  if (estadoSla === 'resolvida_fora_prazo') {
    return `Resolvida depois do prazo configurado (prazo era ${dkToLabel(pendencia.prazo)}).`;
  }
  return null;
}

function resultadoTexto(pendencia: Pendencia): string {
  const base = pendencia.resolvidaEm
    ? `${STATUS_PENDENCIA_LABEL[pendencia.status]} — resolvido em ${new Date(pendencia.resolvidaEm).toLocaleString('pt-BR')}. Prioridade: ${PRIORIDADE_LABEL[pendencia.prioridade]}.`
    : `${STATUS_PENDENCIA_LABEL[pendencia.status]}. Prioridade: ${PRIORIDADE_LABEL[pendencia.prioridade]}.`;
  if ((pendencia.status === 'aprovado' || pendencia.status === 'reprovado') && pendencia.revisadoEm) {
    return `${base} Revisão (${STATUS_PENDENCIA_LABEL[pendencia.status]}) em ${new Date(pendencia.revisadoEm).toLocaleString('pt-BR')}.`;
  }
  return base;
}

/* `dateKey`/`item` vêm sempre de um caso já carregado ao vivo pela tela (useHEEngineData) — este
 * service não busca nada sozinho no motor, só recebe o que a interface já tem em mãos e formata.
 * `usuarios` = `workspace.users` (Fase 2, Etapa 6, pra exibir o nome do responsável — nunca só o
 * id). `alertaAntecedenciaDias` = `workspace.rules.alertaAntecedenciaDias` (Fase 2, Etapa 7). */
export function explicarPendencia(
  workspaceId: string,
  dateKey: string,
  pendencia: Pendencia,
  item: HEItemComputed,
  toleranceMin: number,
  usuarios: UserAccess[],
  alertaAntecedenciaDias: number,
): ExplicacaoPendencia {
  const temPadrao = item.padraoMin !== null && item.padraoMin !== undefined;
  const heCalculada = temPadrao ? calcularHoraExtraDoDia(workspaceId, dateKey, item.motorista, toleranceMin) : null;
  const excedenteMin = temPadrao && heCalculada ? heCalculada.heExcedenteMin : null;
  const estadoSla = calcularEstadoSla(pendencia, alertaAntecedenciaDias);
  const responsavel = usuarios.find((u) => u.id === pendencia.responsavelId)?.nome ?? null;

  const dadosConsiderados: DadoConsiderado[] = [
    { label: 'Colaborador (nome no registro de ponto)', valor: item.motorista || null },
    { label: 'Vínculo com cadastro de Colaboradores', valor: pendencia.colaboradorId },
    { label: 'Data', valor: pendencia.data },
    { label: 'Horário padrão cadastrado', valor: item.padraoHorarios.length ? item.padraoHorarios.join(', ') : null },
    { label: 'HE programada', valor: temPadrao ? minToStr(item.padraoMin as number) : null },
    { label: 'HE realizada', valor: minToStr(item._heMin) },
    { label: 'Excedente (HE realizada − HE programada)', valor: excedenteMin !== null ? minToStrSigned(excedenteMin) : null },
    { label: 'Tolerância configurada (workspace atual)', valor: `${toleranceMin} min` },
    { label: 'Registros de ponto do dia', valor: item.batidas || null },
    { label: 'Confirmação por rastreio', valor: statusLabel(item._status) },
    { label: 'Nota do motor sobre o rastreio', valor: item.detalhe || null },
    { label: 'Nota técnica do motor sobre o padrão', valor: item.padraoDebug || null },
    { label: 'Causa provável', valor: pendencia.categoria },
    { label: 'Setor responsável (motor)', valor: item._setor || null },
    { label: 'Justificativa registrada', valor: item._justificativa || null },
    { label: 'Responsável atribuído', valor: responsavel },
    { label: 'Prazo', valor: pendencia.prazo ? dkToLabel(pendencia.prazo) : null },
    { label: 'Estado do SLA', valor: ESTADO_SLA_LABEL[estadoSla] },
    { label: 'Revisado por', valor: pendencia.revisadoPor },
    { label: 'Observação da revisão', valor: pendencia.observacaoRevisao },
  ];

  const regraAplicada = temPadrao
    ? `Diferença = HE realizada − HE programada. Se diferença > tolerância configurada (${toleranceMin} min), o caso é sinalizado. Aqui: diferença de ${excedenteMin !== null ? minToStrSigned(excedenteMin) : '—'}.`
    : null;

  return {
    motivo: motivoParaStatus(pendencia, item, toleranceMin, excedenteMin),
    dadosConsiderados,
    regraAplicada,
    resultado: resultadoTexto(pendencia),
    evidencias: pendencia.evidencias,
    origem: ORIGEM_LABEL[pendencia.origem],
    notaPrazo: textoNotaPrazo(pendencia, estadoSla),
  };
}
