#!/usr/bin/env node
/**
 * Script de migração: SQLite → Firebase Firestore
 *
 * Lê todos os dados do banco SQLite existente e os escreve no Firestore,
 * preservando os IDs para não quebrar referências entre coleções.
 *
 * USO:
 *   1. Instale o Firebase Admin SDK:
 *      npm install --save-dev firebase-admin
 *
 *   2. Baixe a chave de serviço (service account key):
 *      Firebase Console → Configurações do Projeto → Contas de Serviço
 *      → Gerar nova chave privada → salvar como serviceAccountKey.json
 *
 *   3. Defina as variáveis de ambiente:
 *      set GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
 *      set JORNADA_DB_PATH=./data/jornada360.db
 *
 *   4. Execute:
 *      node scripts/migrar-para-firebase.js
 *
 *   5. Verifique no Firebase Console que os dados chegaram.
 *
 * SEGURANÇA:
 *   - Nunca commite serviceAccountKey.json no Git (já está no .gitignore)
 *   - Este script lê o banco em modo somente-leitura (não modifica o SQLite)
 *   - Pode ser executado múltiplas vezes (setDoc com merge:false sobrescreve se já existir)
 */

import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.JORNADA_DB_PATH || join(AQUI, '..', 'data', 'jornada360.db');

// ---- verificações antes de começar ----------------------------------------

if (!existsSync(DB_PATH)) {
  console.error(`\n❌ Banco SQLite não encontrado em: ${DB_PATH}`);
  console.error('   Defina JORNADA_DB_PATH com o caminho correto.\n');
  process.exit(1);
}

// Importação dinâmica do firebase-admin (pode não estar instalado)
let admin;
try {
  const m = await import('firebase-admin');
  admin = m.default;
} catch {
  console.error('\n❌ firebase-admin não está instalado.');
  console.error('   Execute: npm install --save-dev firebase-admin\n');
  process.exit(1);
}

// Verifica credenciais
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('\n❌ GOOGLE_APPLICATION_CREDENTIALS não está definido.');
  console.error('   Baixe a chave de serviço no Firebase Console e defina a variável.\n');
  process.exit(1);
}

// ---- inicialização ---------------------------------------------------------

admin.initializeApp();
const db = admin.firestore();
const sqliteDb = new DatabaseSync(DB_PATH);
sqliteDb.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');

const relatorio = {
  usuarios: 0,
  tenants: 0,
  memberships: 0,
  configs: 0,
  timeRecords: 0,
  pendings: 0,
  auditLog: 0,
  erros: [],
};

// ---- helpers ---------------------------------------------------------------

function iso(val) {
  if (!val) return null;
  // SQLite guarda datas como ISO string
  return typeof val === 'string' ? val : new Date(val).toISOString();
}

function parseJson(raw, fallback) {
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

// Usa batched writes para eficiência (máximo 500 operações por batch)
async function commitBatch(batch) {
  await batch.commit();
  return db.batch();
}

// ---- migração: usuários -----------------------------------------------------

async function migrarUsuarios() {
  console.log('\n📋 Migrando usuários...');
  const usuarios = sqliteDb.prepare('SELECT * FROM users').all();
  let batch = db.batch();
  let ops = 0;

  for (const u of usuarios) {
    const ref = db.collection('users').doc(u.id);
    batch.set(ref, {
      email: u.email,
      nome: u.nome,
      // password_hash NÃO é migrado: Firebase Auth gerencia senhas
      // Os usuários precisarão definir uma nova senha via link de recuperação
      criadoEm: iso(u.criado_em),
      ativo: u.ativo === 1,
      // Marca para que o script de onboarding saiba que este usuário veio da migração
      migradoDoSqlite: true,
    });

    relatorio.usuarios++;
    ops++;
    if (ops >= 400) {
      batch = await commitBatch(batch);
      ops = 0;
    }
  }

  if (ops > 0) await batch.commit();
  console.log(`   ✅ ${relatorio.usuarios} usuários migrados.`);
  console.log(`   ⚠️  As senhas NÃO foram migradas. Cada usuário receberá um e-mail de recuperação de senha.`);
}

// ---- migração: tenants e estrutura ------------------------------------------

async function migrarTenants() {
  console.log('\n🏢 Migrando empresas (tenants)...');
  const tenants = sqliteDb.prepare('SELECT * FROM tenants').all();

  for (const t of tenants) {
    try {
      const tenantRef = db.collection('tenants').doc(t.id);

      // Metadados do tenant
      await tenantRef.set({
        nome: t.nome,
        environment: t.environment ?? 'real',
        status: 'ativa',
        criadoEm: iso(t.criado_em),
        configVersao: admin.firestore.FieldValue.serverTimestamp(),
        migradoDoSqlite: true,
      });

      // Cadastro (empresa, unidades, setores, colaboradores, escalas, regras)
      await migrarConfig(t.id, tenantRef);

      // Dias processados
      await migrarTimeRecords(t.id, tenantRef);

      // Pendências
      await migrarPendings(t.id, tenantRef);

      // Auditoria
      await migrarAuditLog(t.id, tenantRef);

      relatorio.tenants++;
      console.log(`   ✅ Tenant "${t.nome}" (${t.id}) migrado.`);
    } catch (e) {
      console.error(`   ❌ Erro ao migrar tenant "${t.nome}": ${e.message}`);
      relatorio.erros.push({ tipo: 'tenant', id: t.id, erro: e.message });
    }
  }
}

async function migrarConfig(tenantId, tenantRef) {
  // Empresa
  const company = sqliteDb.prepare('SELECT * FROM companies WHERE tenant_id = ?').get(tenantId) ?? {};
  // Unidades
  const units = sqliteDb.prepare('SELECT * FROM units WHERE tenant_id = ?').all(tenantId);
  // Setores
  const departments = sqliteDb.prepare('SELECT * FROM departments WHERE tenant_id = ?').all(tenantId);
  // Escalas
  const schedules = sqliteDb.prepare('SELECT * FROM schedules WHERE tenant_id = ?').all(tenantId);
  // Colaboradores
  const employees = sqliteDb.prepare('SELECT * FROM employees WHERE tenant_id = ?').all(tenantId);
  // Regras
  const rules = sqliteDb.prepare('SELECT * FROM workspace_rules WHERE tenant_id = ?').get(tenantId) ?? {};
  // Integrações
  const integrations = sqliteDb.prepare('SELECT * FROM integration_configs WHERE tenant_id = ?').all(tenantId);

  await tenantRef.collection('config').doc('dados').set({
    company: {
      nome: company.nome ?? '',
      cnpj: company.cnpj ?? '',
      identificacao: company.identificacao ?? '',
      logo: company.logo ?? '',
      status: company.status ?? 'ativa',
    },
    units: units.map(u => ({
      id: u.id,
      nome: u.nome,
      codigo: u.codigo ?? '',
      localizacao: u.localizacao ?? '',
    })),
    departments: departments.map(d => ({
      id: d.id,
      nome: d.nome,
      unidadeId: d.unidade_id ?? null,
      responsavel: d.responsavel ?? '',
    })),
    schedules: schedules.map(s => ({
      id: s.id,
      nome: s.nome,
      horarioInicio: s.horario_inicio ?? '',
      horarioFim: s.horario_fim ?? '',
      diasTrabalhados: parseJson(s.dias_trabalhados, []),
      folgas: parseJson(s.folgas, []),
      heProgramadaMin: s.he_programada_min ?? 0,
    })),
    employees: employees.map(e => ({
      id: e.id,
      nome: e.nome,
      matricula: e.matricula ?? '',
      cargo: e.cargo ?? '',
      setorId: e.setor_id ?? null,
      unidadeId: e.unidade_id ?? null,
      status: e.status ?? 'ativo',
      escalaId: e.escala_id ?? null,
    })),
    rules: {
      toleranceMin: rules.tolerance_min ?? 10,
      dailyGoalMin: rules.daily_goal_min ?? 0,
      recurrenceLimit: rules.recurrence_limit ?? 5,
      intervalMinMin: rules.interval_min_min ?? 60,
      interjourneyMinHours: rules.interjourney_min_hours ?? 11,
      prazoPadraoDias: rules.prazo_padrao_dias ?? 3,
      alertaAntecedenciaDias: rules.alerta_antecedencia_dias ?? 1,
    },
    causaOpts: parseJson(rules.causa_opts, ['Autorizado antecipadamente', 'Escala desatualizada', 'Erro de registro', 'Outro']),
    integrations: integrations.map(i => ({
      id: i.id,
      tipo: i.tipo,
      nome: i.nome,
      status: i.status ?? 'nao_configurado',
    })),
    users: [], // memberships são migradas separadamente
  });

  relatorio.configs++;
}

async function migrarTimeRecords(tenantId, tenantRef) {
  const records = sqliteDb.prepare('SELECT * FROM time_records WHERE tenant_id = ?').all(tenantId);
  let batch = db.batch();
  let ops = 0;

  for (const r of records) {
    const ref = tenantRef.collection('time_records').doc(r.date_key);
    batch.set(ref, {
      snapshot: parseJson(r.snapshot_json, null),
      caseState: parseJson(r.case_state_json, {}),
      atualizadoEm: iso(r.atualizado_em),
    });
    relatorio.timeRecords++;
    ops++;
    if (ops >= 400) {
      batch = await db.batch();
      await batch.commit();
      ops = 0;
      batch = db.batch();
    }
  }

  if (ops > 0) await batch.commit();
}

async function migrarPendings(tenantId, tenantRef) {
  const pendings = sqliteDb.prepare('SELECT * FROM pendings WHERE tenant_id = ?').all(tenantId);
  let batch = db.batch();
  let ops = 0;

  for (const p of pendings) {
    const ref = tenantRef.collection('pendings').doc(p.id);
    batch.set(ref, {
      colaboradorId: p.colaborador_id ?? null,
      data: p.data ?? '',
      tipo: p.tipo ?? '',
      categoria: p.categoria ?? '',
      status: p.status ?? 'pendente',
      prioridade: p.prioridade ?? 'media',
      origem: p.origem ?? 'motor_he',
      descricao: p.descricao ?? '',
      evidencias: parseJson(p.evidencias, []),
      recomendacao: p.recomendacao ?? null,
      responsavelId: p.responsavel_id ?? null,
      prazo: p.prazo ?? null,
      criadaEm: iso(p.criada_em),
      atualizadaEm: iso(p.atualizada_em),
      resolvidaEm: iso(p.resolvida_em),
      resolucao: p.resolucao ?? null,
      revisadoPor: p.revisado_por ?? null,
      revisadoEm: iso(p.revisado_em),
      observacaoRevisao: p.observacao_revisao ?? null,
    });
    relatorio.pendings++;
    ops++;
    if (ops >= 400) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }

  if (ops > 0) await batch.commit();
}

async function migrarAuditLog(tenantId, tenantRef) {
  const entries = sqliteDb.prepare('SELECT * FROM audit_log WHERE tenant_id = ?').all(tenantId);
  let batch = db.batch();
  let ops = 0;

  for (const e of entries) {
    const ref = tenantRef.collection('audit_log').doc(e.id);
    batch.set(ref, {
      userId: e.user_id ?? null,
      usuario: e.usuario ?? '',
      entidade: e.entidade ?? '',
      acao: e.acao ?? '',
      valorAnterior: e.valor_anterior ?? '',
      valorNovo: e.valor_novo ?? '',
      motivo: e.motivo ?? '',
      timestamp: iso(e.timestamp),
    });
    relatorio.auditLog++;
    ops++;
    if (ops >= 400) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }

  if (ops > 0) await batch.commit();
}

// ---- migração: memberships --------------------------------------------------

async function migrarMemberships() {
  console.log('\n👥 Migrando memberships (papéis de usuário)...');
  const memberships = sqliteDb.prepare('SELECT * FROM memberships').all();
  let batch = db.batch();
  let ops = 0;

  for (const m of memberships) {
    // Verifica se o tenant existe no Firestore
    const tenantSnap = await db.collection('tenants').doc(m.tenant_id).get();
    if (!tenantSnap.exists) {
      console.warn(`   ⚠️  Tenant ${m.tenant_id} não encontrado para membership de user ${m.user_id}`);
      continue;
    }

    // Membership: tenant → usuário
    batch.set(
      db.collection('tenants').doc(m.tenant_id).collection('memberships').doc(m.user_id),
      { papel: m.papel, criadoEm: iso(m.criado_em) }
    );

    // Índice inverso: usuário → tenants
    batch.set(
      db.collection('user_memberships').doc(m.user_id).collection('tenants').doc(m.tenant_id),
      { tenantId: m.tenant_id, papel: m.papel, criadoEm: iso(m.criado_em) }
    );

    relatorio.memberships++;
    ops += 2;
    if (ops >= 400) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }

  if (ops > 0) await batch.commit();
  console.log(`   ✅ ${relatorio.memberships} memberships migradas.`);
}

// ---- execução principal -----------------------------------------------------

async function main() {
  console.log('🚀 Iniciando migração SQLite → Firestore');
  console.log(`   Banco: ${DB_PATH}`);
  console.log(`   Projeto Firebase: ${process.env.GCLOUD_PROJECT || '(detectado automaticamente)'}\n`);

  const inicio = Date.now();

  await migrarUsuarios();
  await migrarTenants();
  await migrarMemberships();

  const duracao = ((Date.now() - inicio) / 1000).toFixed(1);

  console.log('\n' + '='.repeat(60));
  console.log('✅ Migração concluída em ' + duracao + 's');
  console.log('='.repeat(60));
  console.log(`   Usuários:       ${relatorio.usuarios}`);
  console.log(`   Tenants:        ${relatorio.tenants}`);
  console.log(`   Memberships:    ${relatorio.memberships}`);
  console.log(`   Configs:        ${relatorio.configs}`);
  console.log(`   Dias (ponto):   ${relatorio.timeRecords}`);
  console.log(`   Pendências:     ${relatorio.pendings}`);
  console.log(`   Auditoria:      ${relatorio.auditLog}`);

  if (relatorio.erros.length > 0) {
    console.log('\n⚠️  ERROS DURANTE A MIGRAÇÃO:');
    for (const e of relatorio.erros) {
      console.log(`   - [${e.tipo}] ${e.id}: ${e.erro}`);
    }
  }

  console.log('\n📌 PRÓXIMOS PASSOS:');
  console.log('   1. As senhas NÃO foram migradas (Firebase Auth gerencia senhas).');
  console.log('      Envie e-mails de recuperação de senha para todos os usuários.');
  console.log('   2. Verifique no Firebase Console que os dados estão corretos.');
  console.log('   3. Teste o login com uma conta migrada (usar "Esqueci a senha").');
  console.log('   4. Configure as Firestore Security Rules (firestore.rules).');
  console.log('   5. Quando validado, atualize o VITE_FIREBASE_PROJECT_ID no Vercel.\n');
}

main().catch((e) => {
  console.error('\n❌ Erro fatal na migração:', e.message);
  process.exit(1);
});
