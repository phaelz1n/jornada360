/* Dados operacionais: dias processados pelo motor, pendências e auditoria.
 *
 * O snapshot do motor é guardado como JSON opaco. O backend NÃO interpreta, valida campo a campo
 * nem recalcula nada dele — é exatamente essa decisão que permite o motor HE continuar intocado.
 * Quem entende o formato é o motor e o frontend; o servidor apenas persiste e devolve, com o
 * tenant correto. */
import { abrirBanco } from '../db/index.js';
import { novoId } from '../lib/seguranca.js';

/* ---------------------------------------------------------------- dias processados */

export function listarDatas(tenantId) {
  return abrirBanco()
    .prepare('SELECT date_key FROM time_records WHERE tenant_id = ? ORDER BY date_key')
    .all(tenantId)
    .map((r) => r.date_key);
}

/* Todos os dias com snapshot e caseState, numa consulta só.
 *
 * A interface calcula indicadores, ranking, score e relatórios sobre a série INTEIRA — buscar dia a
 * dia significaria centenas de requisições ao abrir o Dashboard. Carregar tudo é adequado para o
 * volume de uma empresa (um dia processado tem dezenas de registros, não milhares); um recorte por
 * período entra quando o volume justificar, e está anotado como evolução em FRONTEND_BACKEND.md. */
export function listarDiasCompletos(tenantId) {
  return abrirBanco()
    .prepare('SELECT date_key, snapshot_json, case_state_json FROM time_records WHERE tenant_id = ? ORDER BY date_key')
    .all(tenantId)
    .map((r) => ({
      dateKey: r.date_key,
      snapshot: JSON.parse(r.snapshot_json),
      caseState: JSON.parse(r.case_state_json),
    }));
}

export function obterDia(tenantId, dateKey) {
  const r = abrirBanco()
    .prepare('SELECT * FROM time_records WHERE tenant_id = ? AND date_key = ?')
    .get(tenantId, dateKey);
  if (!r) return null;
  return { dateKey: r.date_key, snapshot: JSON.parse(r.snapshot_json), caseState: JSON.parse(r.case_state_json) };
}

export function salvarDia(tenantId, dateKey, snapshot, caseState) {
  const db = abrirBanco();
  const agora = new Date().toISOString();
  const existente = obterDia(tenantId, dateKey);

  db.prepare(
    `INSERT INTO time_records (id, tenant_id, date_key, snapshot_json, case_state_json, atualizado_em)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (tenant_id, date_key) DO UPDATE SET
       snapshot_json = excluded.snapshot_json,
       case_state_json = excluded.case_state_json,
       atualizado_em = excluded.atualizado_em`,
  ).run(
    novoId('tr'), tenantId, dateKey,
    JSON.stringify(snapshot),
    /* Preserva o progresso já registrado quando quem chama só reenvia o snapshot — reprocessar
     * um dia não pode apagar as justificativas que alguém já escreveu. */
    JSON.stringify(caseState ?? existente?.caseState ?? {}),
    agora,
  );
  return obterDia(tenantId, dateKey);
}

/* Atualiza o estado de UM caso dentro do dia (setor/causa/justificativa/done/heCorrigida).
 * Faz merge em vez de substituir, para não perder campos que não vieram no patch. */
export function atualizarCaso(tenantId, dateKey, chaveColaborador, patch) {
  const dia = obterDia(tenantId, dateKey);
  if (!dia) return null;
  const caseState = { ...dia.caseState, [chaveColaborador]: { ...(dia.caseState[chaveColaborador] ?? {}), ...patch } };
  return salvarDia(tenantId, dateKey, dia.snapshot, caseState);
}

export function limparDias(tenantId) {
  const db = abrirBanco();
  const n = db.prepare('SELECT COUNT(*) AS n FROM time_records WHERE tenant_id = ?').get(tenantId).n;
  db.prepare('DELETE FROM time_records WHERE tenant_id = ?').run(tenantId);
  return n;
}

/* ---------------------------------------------------------------- pendências */

const CAMPOS_PENDENCIA = `id, colaborador_id AS colaboradorId, data, tipo, categoria, status, prioridade,
  origem, descricao, evidencias, recomendacao, responsavel_id AS responsavelId, prazo,
  criada_em AS criadaEm, atualizada_em AS atualizadaEm, resolvida_em AS resolvidaEm, resolucao,
  revisado_por AS revisadoPor, revisado_em AS revisadoEm, observacao_revisao AS observacaoRevisao`;

function hidratar(r, tenantId) {
  return { ...r, workspaceId: tenantId, evidencias: JSON.parse(r.evidencias) };
}

export function listarPendencias(tenantId) {
  return abrirBanco()
    .prepare(`SELECT ${CAMPOS_PENDENCIA} FROM pendings WHERE tenant_id = ? ORDER BY data DESC`)
    .all(tenantId)
    .map((r) => hidratar(r, tenantId));
}

export function obterPendencia(tenantId, id) {
  const r = abrirBanco()
    .prepare(`SELECT ${CAMPOS_PENDENCIA} FROM pendings WHERE tenant_id = ? AND id = ?`)
    .get(tenantId, id);
  return r ? hidratar(r, tenantId) : null;
}

export function salvarPendencia(tenantId, p) {
  abrirBanco()
    .prepare(
      `INSERT INTO pendings (id, tenant_id, colaborador_id, data, tipo, categoria, status, prioridade,
         origem, descricao, evidencias, recomendacao, responsavel_id, prazo, criada_em, atualizada_em,
         resolvida_em, resolucao, revisado_por, revisado_em, observacao_revisao)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         colaborador_id = excluded.colaborador_id, categoria = excluded.categoria,
         status = excluded.status, prioridade = excluded.prioridade, descricao = excluded.descricao,
         evidencias = excluded.evidencias, recomendacao = excluded.recomendacao,
         responsavel_id = excluded.responsavel_id, prazo = excluded.prazo,
         atualizada_em = excluded.atualizada_em, resolvida_em = excluded.resolvida_em,
         resolucao = excluded.resolucao, revisado_por = excluded.revisado_por,
         revisado_em = excluded.revisado_em, observacao_revisao = excluded.observacao_revisao`,
    )
    .run(
      p.id, tenantId, p.colaboradorId ?? null, p.data, p.tipo, p.categoria ?? '', p.status, p.prioridade,
      p.origem, p.descricao ?? '', JSON.stringify(p.evidencias ?? []), p.recomendacao ?? null,
      p.responsavelId ?? null, p.prazo ?? null, p.criadaEm, new Date().toISOString(),
      p.resolvidaEm ?? null, p.resolucao ?? null, p.revisadoPor ?? null, p.revisadoEm ?? null,
      p.observacaoRevisao ?? null,
    );
  return obterPendencia(tenantId, p.id);
}

export function limparPendencias(tenantId) {
  abrirBanco().prepare('DELETE FROM pendings WHERE tenant_id = ?').run(tenantId);
}

/* ---------------------------------------------------------------- auditoria */

/* O `usuario` NÃO vem do cliente: é resolvido da sessão por quem chama (ver services/auditService).
 * É o que torna a trilha confiável — diferente da versão local, onde o frontend escolhia o autor. */
export function registrarAuditoria(tenantId, { userId, usuario, entidade, acao, valorAnterior, valorNovo, motivo }) {
  const db = abrirBanco();
  const entrada = {
    id: novoId('aud'),
    usuario,
    entidade,
    acao,
    valorAnterior: valorAnterior ?? '',
    valorNovo: valorNovo ?? '',
    motivo: motivo ?? '',
    timestamp: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO audit_log (id, tenant_id, user_id, usuario, entidade, acao, valor_anterior, valor_novo, motivo, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(entrada.id, tenantId, userId ?? null, entrada.usuario, entrada.entidade, entrada.acao,
    entrada.valorAnterior, entrada.valorNovo, entrada.motivo, entrada.timestamp);
  return entrada;
}

export function listarAuditoria(tenantId, limite = 500) {
  return abrirBanco()
    .prepare(
      `SELECT id, usuario, entidade, acao, valor_anterior AS valorAnterior, valor_novo AS valorNovo,
              motivo, timestamp
       FROM audit_log WHERE tenant_id = ? ORDER BY timestamp DESC LIMIT ?`,
    )
    .all(tenantId, limite);
}
