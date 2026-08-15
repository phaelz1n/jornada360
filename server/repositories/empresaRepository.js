/* Cadastro da empresa: dados da companhia, unidades, setores, escalas, colaboradores, regras e
 * integrações. Toda função recebe `tenantId` primeiro e filtra por ele — sem exceção. */
import { abrirBanco } from '../db/index.js';
import { novoId } from '../lib/seguranca.js';

/* ---------------------------------------------------------------- empresa */

export function obterEmpresa(tenantId) {
  const r = abrirBanco().prepare('SELECT * FROM companies WHERE tenant_id = ?').get(tenantId);
  if (!r) return null;
  return { nome: r.nome, cnpj: r.cnpj, identificacao: r.identificacao, logo: r.logo, status: r.status };
}

export function salvarEmpresa(tenantId, dados) {
  const db = abrirBanco();
  db.prepare(
    `UPDATE companies SET nome = ?, cnpj = ?, identificacao = ?, logo = ?, status = ? WHERE tenant_id = ?`,
  ).run(dados.nome ?? '', dados.cnpj ?? '', dados.identificacao ?? '', dados.logo ?? '', dados.status ?? 'ativa', tenantId);
  /* O nome do tenant acompanha o nome da empresa — é o rótulo mostrado no seletor. */
  db.prepare('UPDATE tenants SET nome = ? WHERE id = ?').run(dados.nome ?? '', tenantId);
  return obterEmpresa(tenantId);
}

/* ---------------------------------------------------------------- unidades */

export function listarUnidades(tenantId) {
  return abrirBanco()
    .prepare('SELECT id, nome, codigo, localizacao FROM units WHERE tenant_id = ? ORDER BY nome')
    .all(tenantId);
}

export function salvarUnidade(tenantId, u) {
  const db = abrirBanco();
  const id = u.id || novoId('un');
  db.prepare(
    `INSERT INTO units (id, tenant_id, nome, codigo, localizacao) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET nome = excluded.nome, codigo = excluded.codigo, localizacao = excluded.localizacao`,
  ).run(id, tenantId, u.nome, u.codigo ?? '', u.localizacao ?? '');
  return { id, nome: u.nome, codigo: u.codigo ?? '', localizacao: u.localizacao ?? '' };
}

/* O `AND tenant_id = ?` no DELETE não é redundante: sem ele, alguém que descobrisse o id de uma
 * unidade de outro tenant conseguiria apagá-la. É a proteção contra IDOR no nível da consulta. */
export function excluirUnidade(tenantId, id) {
  abrirBanco().prepare('DELETE FROM units WHERE id = ? AND tenant_id = ?').run(id, tenantId);
}

/* ---------------------------------------------------------------- setores */

export function listarSetores(tenantId) {
  return abrirBanco()
    .prepare('SELECT id, nome, unidade_id AS unidadeId, responsavel FROM departments WHERE tenant_id = ? ORDER BY nome')
    .all(tenantId);
}

export function salvarSetor(tenantId, d) {
  const db = abrirBanco();
  const id = d.id || novoId('set');
  db.prepare(
    `INSERT INTO departments (id, tenant_id, nome, unidade_id, responsavel) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET nome = excluded.nome, unidade_id = excluded.unidade_id, responsavel = excluded.responsavel`,
  ).run(id, tenantId, d.nome, d.unidadeId ?? null, d.responsavel ?? '');
  return { id, nome: d.nome, unidadeId: d.unidadeId ?? null, responsavel: d.responsavel ?? '' };
}

export function excluirSetor(tenantId, id) {
  abrirBanco().prepare('DELETE FROM departments WHERE id = ? AND tenant_id = ?').run(id, tenantId);
}

/* ---------------------------------------------------------------- escalas */

/* `entrada`/`saida` são os nomes do domínio (src/domain/Schedule.ts). As colunas do banco usam
 * snake_case por convenção SQL; o mapeamento acontece aqui, e em nenhum outro lugar — o frontend
 * recebe exatamente o formato que já esperava. */
export function listarEscalas(tenantId) {
  return abrirBanco()
    .prepare('SELECT * FROM schedules WHERE tenant_id = ? ORDER BY nome')
    .all(tenantId)
    .map((r) => ({
      id: r.id,
      nome: r.nome,
      entrada: r.horario_inicio,
      saida: r.horario_fim,
      diasTrabalhados: JSON.parse(r.dias_trabalhados),
      folgas: JSON.parse(r.folgas),
      heProgramadaMin: r.he_programada_min,
    }));
}

export function salvarEscala(tenantId, s) {
  const db = abrirBanco();
  const id = s.id || novoId('esc');
  db.prepare(
    `INSERT INTO schedules (id, tenant_id, nome, horario_inicio, horario_fim, dias_trabalhados, folgas, he_programada_min)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET nome = excluded.nome, horario_inicio = excluded.horario_inicio,
       horario_fim = excluded.horario_fim, dias_trabalhados = excluded.dias_trabalhados,
       folgas = excluded.folgas, he_programada_min = excluded.he_programada_min`,
  ).run(
    id, tenantId, s.nome, s.entrada ?? '', s.saida ?? '',
    JSON.stringify(s.diasTrabalhados ?? []), JSON.stringify(s.folgas ?? []), s.heProgramadaMin ?? 0,
  );
  return { ...s, id };
}

export function excluirEscala(tenantId, id) {
  abrirBanco().prepare('DELETE FROM schedules WHERE id = ? AND tenant_id = ?').run(id, tenantId);
}

/* ---------------------------------------------------------------- colaboradores */

export function listarColaboradores(tenantId) {
  return abrirBanco()
    .prepare(
      `SELECT id, nome, matricula, cargo, setor_id AS setorId, unidade_id AS unidadeId, status, escala_id AS escalaId
       FROM employees WHERE tenant_id = ? ORDER BY nome`,
    )
    .all(tenantId);
}

export function salvarColaborador(tenantId, e) {
  const db = abrirBanco();
  const id = e.id || novoId('col');
  db.prepare(
    `INSERT INTO employees (id, tenant_id, nome, matricula, cargo, setor_id, unidade_id, status, escala_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET nome = excluded.nome, matricula = excluded.matricula, cargo = excluded.cargo,
       setor_id = excluded.setor_id, unidade_id = excluded.unidade_id, status = excluded.status, escala_id = excluded.escala_id`,
  ).run(id, tenantId, e.nome, e.matricula ?? '', e.cargo ?? '', e.setorId ?? null, e.unidadeId ?? null, e.status ?? 'ativo', e.escalaId ?? null);
  return { ...e, id };
}

export function excluirColaborador(tenantId, id) {
  abrirBanco().prepare('DELETE FROM employees WHERE id = ? AND tenant_id = ?').run(id, tenantId);
}

/* ---------------------------------------------------------------- regras */

export function obterRegras(tenantId) {
  const r = abrirBanco().prepare('SELECT * FROM workspace_rules WHERE tenant_id = ?').get(tenantId);
  if (!r) return null;
  return {
    regras: {
      toleranceMin: r.tolerance_min,
      dailyGoalMin: r.daily_goal_min,
      recurrenceLimit: r.recurrence_limit,
      intervalMinMin: r.interval_min_min,
      interjourneyMinHours: r.interjourney_min_hours,
      prazoPadraoDias: r.prazo_padrao_dias,
      alertaAntecedenciaDias: r.alerta_antecedencia_dias,
    },
    causaOpts: JSON.parse(r.causa_opts),
  };
}

export function salvarRegras(tenantId, { regras, causaOpts }) {
  abrirBanco()
    .prepare(
      `UPDATE workspace_rules SET tolerance_min = ?, daily_goal_min = ?, recurrence_limit = ?,
         interval_min_min = ?, interjourney_min_hours = ?, prazo_padrao_dias = ?,
         alerta_antecedencia_dias = ?, causa_opts = ?
       WHERE tenant_id = ?`,
    )
    .run(
      regras.toleranceMin, regras.dailyGoalMin, regras.recurrenceLimit, regras.intervalMinMin,
      regras.interjourneyMinHours, regras.prazoPadraoDias, regras.alertaAntecedenciaDias,
      JSON.stringify(causaOpts ?? []), tenantId,
    );
  return obterRegras(tenantId);
}

/* ---------------------------------------------------------------- integrações */

export function listarIntegracoes(tenantId) {
  return abrirBanco()
    .prepare('SELECT id, tipo, nome, status FROM integration_configs WHERE tenant_id = ?')
    .all(tenantId);
}

export function salvarIntegracao(tenantId, i) {
  abrirBanco()
    .prepare('UPDATE integration_configs SET status = ? WHERE id = ? AND tenant_id = ?')
    .run(i.status, i.id, tenantId);
  return listarIntegracoes(tenantId).find((x) => x.id === i.id) ?? null;
}
