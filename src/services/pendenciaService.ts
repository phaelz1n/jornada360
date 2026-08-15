/* Materializa a entidade Pendencia (domain/Pendencia.ts) a partir do que o motor real já calcula —
 * não recalcula status (reaproveita statusDoCaso, Etapa 1), não recalcula HE/padrão/excedente (isso
 * continua sendo responsabilidade exclusiva do motor + toleranceService). Este service só decide
 * QUANDO e COMO transformar um caso do motor em uma unidade de trabalho rastreável.
 *
 * MUDANÇA DA FASE 4 — este service deixou de fazer I/O.
 * Antes ele escrevia direto no `PendingRepository` (localStorage). Agora ele apenas CALCULA qual
 * deve ser o estado de cada pendência e devolve o resultado; quem grava é a camada de dados, que
 * sabe se o destino é o navegador (demonstração) ou o servidor (empresa real).
 *
 * Por que isso importa: uma regra de negócio que escreve sozinha só funciona onde ela conhece o
 * armazenamento. Sem I/O, as MESMAS regras valem nos dois caminhos — e continuam testáveis como
 * funções puras, sem simular storage nenhum.
 *
 * Arquitetura: UI → (este service, puro) → conjunto de repositórios → localStorage OU API. */
import type { HEDiaComputed, HEItemComputed } from '../engine/useHEEngineData';
import { normName } from '../engine/heEngineCore';
import type { Employee } from '../domain';
import { statusDoCaso } from './pendingClassificationService';
import {
  PRIORIDADE_NEUTRA,
  type Pendencia,
  type Prioridade,
  type StatusPendencia,
} from '../domain/Pendencia';

/* Id determinístico (workspace + dia + colaborador normalizado) — a mesma combinação sempre produz
 * o mesmo id, então sincronizar de novo NUNCA duplica uma Pendencia já existente (idempotente). É
 * também, de quebra, o "id estável entre reprocessamentos" citado como gap conhecido no ROADMAP. */
export function idDaPendencia(workspaceId: string, dateKey: string, item: HEItemComputed): string {
  return `pend-${workspaceId}-${dateKey}-${item._key}`;
}

/* Exportada (não só interna) pra Centro de Ações usar a MESMA definição de "resolvido" que a
 * sincronização usa — evita duas fontes de verdade sobre o que conta como resolvido. */
export function estadoResolvido(status: StatusPendencia): boolean {
  return status === 'justificado' || status === 'aprovado' || status === 'reprovado';
}

/* Best-effort: casa o nome do motorista (como veio da planilha) contra o cadastro de Colaboradores
 * por nome normalizado. Retorna null sem erro se não achar — o cadastro de Colaboradores não é
 * obrigatório bater 1:1 com a planilha (ver CONFIGURATION.md), então isso é esperado, não uma falha. */
function vincularColaborador(colaboradores: Employee[], item: HEItemComputed): string | null {
  const alvo = normName(item.motorista);
  const encontrado = colaboradores.find((e) => normName(e.nome) === alvo);
  return encontrado ? encontrado.id : null;
}

function construirEvidencias(item: HEItemComputed): string[] {
  const out: string[] = [];
  if (item.batidas) out.push(`Batidas: ${item.batidas}`);
  if (item.padraoHorarios.length) out.push(`Padrão cadastrado: ${item.padraoHorarios.join(', ')}`);
  return out;
}

function statusRevisado(status: StatusPendencia): boolean {
  return status === 'aprovado' || status === 'reprovado';
}

/* Decide o status "alvo" que a sincronização deve gravar. Normalmente é só `statusDoCaso(item)`
 * (Etapa 1) — mas `statusDoCaso` NUNCA retorna 'aprovado'/'reprovado' (esses só existem via revisão
 * humana explícita, Etapa 8). Sem esta função, toda sincronização reclassificaria um caso já
 * revisado de volta pra 'justificado' (porque `item._done` continua true), apagando a decisão de
 * revisão silenciosamente — exatamente o que a Etapa 8 proíbe. A revisão só é abandonada quando o
 * caso é reaberto de verdade no motor (`item._done` volta a false via `reabrirRevisao`). */
function statusAlvoSincronizacao(existente: Pendencia | null, item: HEItemComputed): StatusPendencia {
  if (existente && statusRevisado(existente.status) && item._done) return existente.status;
  return statusDoCaso(item);
}

/* Calcula qual DEVE ser o estado de uma pendência a partir do caso do motor.
 *
 * Puro: recebe a pendência existente (ou null) e devolve a nova — ou null quando nada mudou, o que
 * evita gravar centenas de registros idênticos a cada sincronização. Toda a lógica de status,
 * resolução e reabertura é a mesma da Fase 2; só saiu o acesso ao armazenamento. */
export function calcularPendencia(
  workspaceId: string,
  dateKey: string,
  item: HEItemComputed,
  existente: Pendencia | null,
  colaboradores: Employee[],
  agora = new Date().toISOString(),
): Pendencia | null {
  const id = idDaPendencia(workspaceId, dateKey, item);
  const status = statusAlvoSincronizacao(existente, item);
  const colaboradorId = vincularColaborador(colaboradores, item);
  const categoria = item._causa || 'Não classificada';
  const descricao = item.detalhe || '';
  const evidencias = construirEvidencias(item);

  if (!existente) {
    return {
      id,
      workspaceId,
      colaboradorId,
      data: dateKey,
      tipo: 'divergencia_he',
      categoria,
      status,
      prioridade: PRIORIDADE_NEUTRA,
      origem: 'motor_he',
      descricao,
      evidencias,
      recomendacao: null,
      responsavelId: null,
      prazo: null,
      criadaEm: agora,
      atualizadaEm: agora,
      resolvidaEm: estadoResolvido(status) ? agora : null,
      resolucao: estadoResolvido(status) ? item._justificativa || null : null,
      revisadoPor: null,
      revisadoEm: null,
      observacaoRevisao: null,
    };
  }

  const camposBasicosMudaram =
    existente.colaboradorId !== colaboradorId ||
    existente.categoria !== categoria ||
    existente.descricao !== descricao ||
    JSON.stringify(existente.evidencias) !== JSON.stringify(evidencias);

  const statusMudou = status !== existente.status;
  const justificativaMudou =
    !statusMudou && status === 'justificado' && existente.resolucao !== (item._justificativa || null);

  /* Nada mudou: devolver null evita reenviar ao servidor uma pendência idêntica à que já está lá.
   * Numa empresa com centenas de dias, gravar tudo a cada abertura de tela seria custoso e encheria
   * a trilha de auditoria de eventos sem informação. */
  if (!camposBasicosMudaram && !statusMudou && !justificativaMudou) return null;

  let atualizada: Pendencia = {
    ...existente,
    colaboradorId,
    categoria,
    descricao,
    evidencias,
    atualizadaEm: agora,
  };

  if (statusMudou) {
    if (statusRevisado(status)) {
      /* Preservado por statusAlvoSincronizacao — não é uma nova resolução, não mexe em resolvidaEm. */
      atualizada = { ...atualizada, status };
    } else if (estadoResolvido(status)) {
      atualizada = { ...atualizada, status, resolvidaEm: agora, resolucao: item._justificativa || null };
    } else if (estadoResolvido(existente.status)) {
      /* Reabertura: o caso voltou a um status não-resolvido (alguém desmarcou `done` no motor).
       * Limpa também `resolvidaEm`/`resolucao` — senão a ficha continuaria dizendo "resolvido em X"
       * numa pendência que está aberta de novo, e o SLA a classificaria como já resolvida. */
      atualizada = { ...atualizada, status, resolvidaEm: null, resolucao: null };
    } else {
      atualizada = { ...atualizada, status };
    }
  } else if (justificativaMudou) {
    /* Mesmo status "resolvido" em ambos, mas o texto da justificativa mudou (editado depois de
     * resolvido) — mantém `resolucao` fiel sem mexer em `resolvidaEm`. */
    atualizada = { ...atualizada, resolucao: item._justificativa || null };
  }

  return atualizada;
}

/* Varre os dias já processados pelo motor e devolve SOMENTE as pendências que precisam ser
 * gravadas (novas ou alteradas). Quem persiste é a camada de dados — ver
 * `RealPendenciasSection`, que chama isto num efeito e grava o resultado. */
export function sincronizarPendencias(
  workspaceId: string,
  dias: HEDiaComputed[],
  existentes: Pendencia[],
  colaboradores: Employee[],
): Pendencia[] {
  const porId = new Map(existentes.map((p) => [p.id, p]));
  const alteradas: Pendencia[] = [];

  for (const dia of dias) {
    for (const item of dia.items) {
      /* Padrão dentro da tolerância nunca vira pendência — não há o que rastrear. */
      if (item._padraoStatus === 'dentro') continue;
      const id = idDaPendencia(workspaceId, dia.dateKey, item);
      const nova = calcularPendencia(workspaceId, dia.dateKey, item, porId.get(id) ?? null, colaboradores);
      if (nova) alteradas.push(nova);
    }
  }

  return alteradas;
}

/* --- Decisões humanas. Todas puras: devolvem a pendência já alterada, e quem chama grava. --- */

/* Único campo com atualização manual desde a Etapa 2 — prova o caminho UI → Service → camada de
 * dados funcionando de forma independente da estrutura do motor: mudar a prioridade não escreve em
 * HECaseState, só na Pendencia. */
export function atualizarPrioridade(pendencia: Pendencia, prioridade: Prioridade): Pendencia {
  return { ...pendencia, prioridade, atualizadaEm: new Date().toISOString() };
}

/* --- Responsável + Prazo (Fase 2, Etapa 6) — decisão humana persistida na própria Pendencia,
 * nunca só em estado de tela. `responsavelId` referencia `UserAccess.id` de `workspace.users`. */

export function atualizarResponsavel(pendencia: Pendencia, responsavelId: string | null): Pendencia {
  return { ...pendencia, responsavelId, atualizadaEm: new Date().toISOString() };
}

export function atualizarPrazo(pendencia: Pendencia, prazo: string | null): Pendencia {
  return { ...pendencia, prazo, atualizadaEm: new Date().toISOString() };
}

/* SUGESTÃO apenas — nunca escreve nada sozinha (mesmo princípio de `recomendarPrioridade`:
 * recomendar não é decidir). `prazoPadraoDias` é o único parâmetro usado, já configurável por
 * empresa (domain/Rules.ts) — nenhum número novo é inventado aqui. */
export function sugerirPrazo(pendencia: Pendencia, prazoPadraoDias: number): string {
  const base = new Date(pendencia.criadaEm);
  base.setDate(base.getDate() + prazoPadraoDias);
  return base.toISOString().slice(0, 10);
}

/* Aprovação e reprovação NÃO estão aqui de propósito.
 *
 * Elas exigem saber QUEM revisou, e essa é a informação que o cliente não pode escolher: no modo
 * conectado o autor vem da sessão, resolvido no servidor (rota `/pendencias/:id/revisao`, permissão
 * separada de tratamento). Um `aprovarPendencia(revisadoPor)` neste arquivo convidaria a passar um
 * nome qualquer — exatamente o que a revisão precisa impedir. A interface chama
 * `repositorios.revisarPendencia`. */

/* Só limpa os campos de revisão na ENTIDADE — reabrir o caso no motor (done:false) é feito por quem
 * chama isto, via o caminho já existente (`useHEEngineData().marcarCampo`), nunca duplicado aqui.
 * Depois que `done` vira false, a próxima sincronização já reclassifica o status sozinha (via
 * `statusAlvoSincronizacao`, que só preserva aprovado/reprovado enquanto `item._done` for true). */
export function reabrirRevisao(pendencia: Pendencia): Pendencia {
  return {
    ...pendencia,
    revisadoPor: null,
    revisadoEm: null,
    observacaoRevisao: null,
    atualizadaEm: new Date().toISOString(),
  };
}

/* --- Centro de Ações (Fase 2, Etapa 3) — funções puras sobre Pendencia[] já carregada, sem I/O.
 * Ordenação e resumo moram aqui (não no componente) pra não haver uma segunda definição de "o que é
 * urgente"/"o que é resolvido" espalhada pela UI. */

const ORDEM_PRIORIDADE: Record<Prioridade, number> = { critica: 0, alta: 1, media: 2, baixa: 3 };

/* Regra de ordenação (documentada em BUSINESS_RULES.md): prioridade crítica → alta → média → baixa;
 * em empate, data mais antiga primeiro (string 'YYYY-MM-DD' compara cronologicamente com
 * localeCompare). Compatível com o dado atual: `prioridade` nunca é null (default 'media') e `data`
 * é sempre uma chave válida. */
export function ordenarPendencias(pendencias: Pendencia[]): Pendencia[] {
  return [...pendencias].sort((a, b) => {
    const porPrioridade = ORDEM_PRIORIDADE[a.prioridade] - ORDEM_PRIORIDADE[b.prioridade];
    if (porPrioridade !== 0) return porPrioridade;
    return a.data.localeCompare(b.data);
  });
}

/* "O que precisa ser feito agora com esta pendência" — derivado do estado dela, não um campo novo.
 * Fica aqui (e não na tela) porque é regra de fluxo: qual é o próximo passo depende de como o ciclo
 * detecção → tratamento → revisão foi definido, e essa definição precisa ser a mesma em toda tela
 * que mostrar a fila. */
export function acaoNecessaria(pendencia: Pendencia): string {
  switch (pendencia.status) {
    case 'divergencia':
    case 'atencao':
      return pendencia.responsavelId
        ? 'Investigar, registrar a causa e a justificativa, e marcar como resolvida.'
        : 'Atribuir um responsável e investigar a ocorrência.';
    case 'pendente':
      return 'Cadastrar o horário padrão do colaborador para que a jornada possa ser avaliada.';
    case 'justificado':
      return 'Revisar a justificativa registrada e aprovar ou reprovar.';
    case 'reprovado':
      return 'Reabrir para novo tratamento — a justificativa anterior foi reprovada.';
    case 'aprovado':
      return 'Nada a fazer: resolvida e aprovada.';
    case 'normal':
      return 'Nada a fazer: dentro do padrão configurado.';
  }
}

/* Situação da revisão em uma frase, para a fila mostrar sem abrir a ficha. */
export function situacaoRevisao(pendencia: Pendencia): string {
  if (pendencia.status === 'aprovado' || pendencia.status === 'reprovado') {
    const quem = pendencia.revisadoPor ?? 'não registrado';
    const quando = pendencia.revisadoEm ? new Date(pendencia.revisadoEm).toLocaleDateString('pt-BR') : 'data não registrada';
    return `${pendencia.status === 'aprovado' ? 'Aprovada' : 'Reprovada'} por ${quem} em ${quando}`;
  }
  if (pendencia.status === 'justificado') return 'Aguardando revisão';
  return 'Ainda não resolvida';
}

export interface ResumoPendencias {
  abertas: number;
  altaPrioridade: number;
  criticas: number;
  resolvidas: number;
}

/* Sempre sobre a lista COMPLETA do workspace (não a filtrada pela tela) — os cards do Centro de
 * Ações mostram o estado geral, não o recorte que o usuário está filtrando no momento. */
export function resumoPendencias(pendencias: Pendencia[]): ResumoPendencias {
  let abertas = 0;
  let altaPrioridade = 0;
  let criticas = 0;
  let resolvidas = 0;
  for (const p of pendencias) {
    if (estadoResolvido(p.status)) {
      resolvidas++;
      continue;
    }
    abertas++;
    if (p.prioridade === 'alta') altaPrioridade++;
    if (p.prioridade === 'critica') criticas++;
  }
  return { abertas, altaPrioridade, criticas, resolvidas };
}
