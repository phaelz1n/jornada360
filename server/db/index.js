/* Conexão com o banco e mecanismo de migrations.
 *
 * SQLite via `node:sqlite` — módulo embutido no Node 22+. Escolhido deliberadamente sobre
 * better-sqlite3/postgres: zero dependência externa, zero compilação nativa (que costuma falhar
 * no Windows), e o mesmo SQL padrão que uma migração futura para Postgres aproveitaria quase
 * inteiro. Para o volume de um sistema de jornada por empresa, SQLite é adequado de sobra.
 *
 * As migrations são versionadas e idempotentes: rodar duas vezes não quebra nem duplica. */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));

let db = null;

/* O caminho vem de variável de ambiente para que test/dev/prod usem bancos diferentes sem
 * nenhuma troca de código — e para que o teste nunca escreva por cima do banco de trabalho. */
export function caminhoBanco() {
  return process.env.JORNADA_DB_PATH || join(AQUI, '..', '..', 'data', 'jornada360.db');
}

export function abrirBanco() {
  if (db) return db;
  const caminho = caminhoBanco();
  if (caminho !== ':memory:') mkdirSync(dirname(caminho), { recursive: true });

  db = new DatabaseSync(caminho);
  /* WAL melhora leitura concorrente; foreign_keys precisa ser ligado por conexão no SQLite
   * (não é padrão), senão as chaves estrangeiras do schema seriam decorativas. */
  if (caminho !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  return db;
}

export function fecharBanco() {
  if (db) {
    db.close();
    db = null;
  }
}

/* Executa o schema. É idempotente (todo CREATE usa IF NOT EXISTS) e registra a versão aplicada,
 * para que uma migração futura saiba de onde continuar em vez de recriar tudo. */
export function migrar() {
  const conexao = abrirBanco();
  conexao.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      versao     INTEGER PRIMARY KEY,
      aplicada_em TEXT NOT NULL
    );
  `);

  const migracoes = [
    { versao: 1, arquivo: 'schema.sql' },
    { versao: 2, arquivo: '002_fase4.sql' },
    { versao: 3, arquivo: '003_fase5.sql' },
    { versao: 4, arquivo: '004_piloto.sql' },
  ];

  const jaAplicadas = new Set(
    conexao.prepare('SELECT versao FROM schema_migrations').all().map((r) => r.versao),
  );

  for (const m of migracoes) {
    if (jaAplicadas.has(m.versao)) continue;
    conexao.exec(readFileSync(join(AQUI, m.arquivo), 'utf8'));
    conexao
      .prepare('INSERT INTO schema_migrations (versao, aplicada_em) VALUES (?, ?)')
      .run(m.versao, new Date().toISOString());
  }

  return conexao;
}

/* Executa uma função dentro de uma transação. Usado onde uma operação toca várias tabelas
 * (criar tenant + empresa + regras + integrações + membership), para não deixar meia empresa
 * gravada se algo falhar no meio. */
export function emTransacao(fn) {
  const conexao = abrirBanco();
  conexao.exec('BEGIN');
  try {
    const r = fn(conexao);
    conexao.exec('COMMIT');
    return r;
  } catch (e) {
    conexao.exec('ROLLBACK');
    throw e;
  }
}
