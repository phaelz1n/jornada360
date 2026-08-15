/* Repositórios do backend.
 *
 * REGRA ABSOLUTA DESTE ARQUIVO E DE TODOS OS IRMÃOS: toda consulta que toca dado empresarial
 * recebe `tenantId` como PRIMEIRO parâmetro e o usa no WHERE. Não existe função aqui que devolva
 * dado sem filtrar por tenant.
 *
 * O `tenantId` nunca vem do corpo da requisição — vem da sessão autenticada, resolvido pelo
 * middleware (ver middlewares/autenticar.js). É a diferença entre "o cliente pediu o tenant X" e
 * "este usuário tem acesso ao tenant X". */
import { abrirBanco, emTransacao } from '../db/index.js';
import { novoId } from '../lib/seguranca.js';

/* Defaults neutros — os MESMOS de src/domain/Rules.ts. Duplicados aqui de propósito: o backend
 * não pode importar do frontend (bundles diferentes), e um cliente criado via API precisa nascer
 * idêntico a um criado localmente. Qualquer mudança tem que ser feita nos dois lugares — está
 * anotado em ambos e coberto por teste. */
export const REGRAS_PADRAO = {
  toleranceMin: 10,
  dailyGoalMin: 0,
  recurrenceLimit: 5,
  intervalMinMin: 60,
  interjourneyMinHours: 11,
  prazoPadraoDias: 3,
  alertaAntecedenciaDias: 1,
};

export const CAUSAS_PADRAO = ['Autorizado antecipadamente', 'Escala desatualizada', 'Erro de registro', 'Outro'];

const INTEGRACOES_PADRAO = [
  { tipo: 'excel_csv', nome: 'Importação Excel/CSV', status: 'configurado' },
  { tipo: 'cobli', nome: 'Cobli (rastreamento)', status: 'nao_configurado' },
  { tipo: 'ponto', nome: 'Sistema de ponto (API/exportação)', status: 'nao_configurado' },
  { tipo: 'api', nome: 'API genérica', status: 'nao_configurado' },
];

/* Cria o tenant e TUDO que uma empresa precisa para existir, numa transação só. Se qualquer
 * passo falhar, nada é gravado — sem meia empresa órfã no banco.
 *
 * `environment` é sempre 'real' por padrão: 'demo' só é usado pelo seed de demonstração, que é um
 * caminho separado e explícito. */
export function criarTenant({ nome, environment = 'real', criadoPorUserId, papel = 'administrador' }) {
  return emTransacao((db) => {
    const agora = new Date().toISOString();
    const tenantId = novoId('ten');

    db.prepare('INSERT INTO tenants (id, nome, environment, criado_em, config_versao) VALUES (?, ?, ?, ?, ?)')
      .run(tenantId, nome, environment, agora, agora);

    db.prepare('INSERT INTO companies (tenant_id, nome) VALUES (?, ?)').run(tenantId, nome);

    db.prepare(
      `INSERT INTO workspace_rules
       (tenant_id, tolerance_min, daily_goal_min, recurrence_limit, interval_min_min,
        interjourney_min_hours, prazo_padrao_dias, alerta_antecedencia_dias, causa_opts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      tenantId,
      REGRAS_PADRAO.toleranceMin,
      REGRAS_PADRAO.dailyGoalMin,
      REGRAS_PADRAO.recurrenceLimit,
      REGRAS_PADRAO.intervalMinMin,
      REGRAS_PADRAO.interjourneyMinHours,
      REGRAS_PADRAO.prazoPadraoDias,
      REGRAS_PADRAO.alertaAntecedenciaDias,
      JSON.stringify(CAUSAS_PADRAO),
    );

    for (const i of INTEGRACOES_PADRAO) {
      db.prepare('INSERT INTO integration_configs (id, tenant_id, tipo, nome, status) VALUES (?, ?, ?, ?, ?)')
        .run(novoId('int'), tenantId, i.tipo, i.nome, i.status);
    }

    if (criadoPorUserId) {
      db.prepare('INSERT INTO memberships (id, user_id, tenant_id, papel, criado_em) VALUES (?, ?, ?, ?, ?)')
        .run(novoId('mem'), criadoPorUserId, tenantId, papel, agora);
    }

    return { id: tenantId, nome, environment, criadoEm: agora };
  });
}

export function buscarTenant(tenantId) {
  return abrirBanco().prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId) ?? null;
}

/* Tenants que um usuário pode acessar, com o papel dele em cada um. É a única fonte de "onde
 * este usuário pode entrar" — nenhuma rota aceita um tenant que não venha daqui. */
export function tenantsDoUsuario(userId) {
  return abrirBanco()
    .prepare(
      /* `status` viaja junto para que a interface possa EXPLICAR uma empresa suspensa em vez de
       * fazê-la sumir da lista. Uma empresa que desaparece parece defeito; uma empresa marcada
       * como suspensa é uma informação. */
      `SELECT t.id, t.nome, t.environment, t.status, m.papel
       FROM memberships m
       JOIN tenants t ON t.id = m.tenant_id
       WHERE m.user_id = ?
       ORDER BY t.criado_em ASC`,
    )
    .all(userId);
}

/* Devolve o papel do usuário NAQUELE tenant, ou null se ele não tem acesso.
 * É a verificação que sustenta todo o isolamento: sem membership, não há acesso. */
export function papelNoTenant(userId, tenantId) {
  const r = abrirBanco()
    .prepare('SELECT papel FROM memberships WHERE user_id = ? AND tenant_id = ?')
    .get(userId, tenantId);
  return r?.papel ?? null;
}

/* Carimbo de versão do cadastro. Muda a cada gravação em qualquer coleção do cadastro; é o que
 * `conflitoDeVersao` compara para recusar uma sobrescrita cega (ver middlewares). */
export function versaoConfig(tenantId) {
  return abrirBanco().prepare('SELECT config_versao FROM tenants WHERE id = ?').get(tenantId)?.config_versao ?? '';
}

export function tocarConfig(tenantId) {
  const agora = `${new Date().toISOString()}#${Math.random().toString(36).slice(2, 8)}`;
  abrirBanco().prepare('UPDATE tenants SET config_versao = ? WHERE id = ?').run(agora, tenantId);
  return agora;
}

export function renomearTenant(tenantId, nome) {
  abrirBanco().prepare('UPDATE tenants SET nome = ? WHERE id = ?').run(nome, tenantId);
}

export function adicionarMembro(tenantId, userId, papel) {
  const db = abrirBanco();
  db.prepare(
    `INSERT INTO memberships (id, user_id, tenant_id, papel, criado_em) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (user_id, tenant_id) DO UPDATE SET papel = excluded.papel`,
  ).run(novoId('mem'), userId, tenantId, papel, new Date().toISOString());
}

export function listarMembros(tenantId) {
  return abrirBanco()
    .prepare(
      `SELECT u.id, u.nome, u.email, m.papel
       FROM memberships m JOIN users u ON u.id = m.user_id
       WHERE m.tenant_id = ? ORDER BY u.nome`,
    )
    .all(tenantId);
}

export function removerMembro(tenantId, userId) {
  abrirBanco().prepare('DELETE FROM memberships WHERE tenant_id = ? AND user_id = ?').run(tenantId, userId);
}

/* Quantos administradores a empresa ainda tem. Usado para impedir que o último seja removido ou
 * rebaixado — uma empresa sem administrador fica sem ninguém capaz de gerir acesso, e recuperar
 * isso exigiria intervenção manual no banco. */
export function contarAdministradores(tenantId) {
  return abrirBanco()
    .prepare("SELECT COUNT(*) AS n FROM memberships WHERE tenant_id = ? AND papel = 'administrador'")
    .get(tenantId).n;
}

/* Exclui o tenant. O `ON DELETE CASCADE` do schema apaga tudo que pertence a ele — é a versão
 * server-side da limpeza que `workspaceService.excluirWorkspace` faz no frontend. */
export function excluirTenant(tenantId) {
  abrirBanco().prepare('DELETE FROM tenants WHERE id = ?').run(tenantId);
}
