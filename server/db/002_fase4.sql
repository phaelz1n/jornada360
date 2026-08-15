-- Migration 2 — Fase 4: integração real do frontend com o backend.
--
-- Nada é recriado nem apagado aqui. A migration só ACRESCENTA o que a Fase 4 passou a exigir,
-- e é idempotente: rodar duas vezes num banco já migrado não altera dado nenhum.
--
-- Por que existe: com várias pessoas e várias máquinas gravando na mesma empresa, "quem salvou por
-- último ganha" deixa de ser aceitável — a alteração de alguém some sem aviso. As colunas abaixo
-- dão a cada agregado um carimbo de versão que o cliente devolve ao gravar; se não bater, o
-- servidor recusa com 409 em vez de sobrescrever em silêncio.

-- Carimbo de versão do CADASTRO da empresa (empresa, unidades, setores, escalas, colaboradores,
-- regras, causas). É um agregado só de propósito: essas coleções são editadas juntas, na mesma
-- tela, e um carimbo por coleção geraria conflitos falsos entre abas que não se atrapalham.
ALTER TABLE tenants ADD COLUMN config_versao TEXT NOT NULL DEFAULT '';

-- Convite de acesso. A entidade existe e funciona; o ENVIO por e-mail não — depende de provedor
-- externo que ainda não existe (ver INTEGRATIONS.md). O administrador entrega o código pelo canal
-- que já usa com a pessoa, e ela o resgata ao criar a conta ou já logada.
CREATE TABLE IF NOT EXISTS invites (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  papel       TEXT NOT NULL,
  -- Só o HASH do código é guardado, pela mesma razão que vale para senha e para token de sessão:
  -- vazar o banco não pode entregar credencial utilizável.
  codigo_hash TEXT NOT NULL UNIQUE,
  criado_por  TEXT REFERENCES users(id) ON DELETE SET NULL,
  criado_em   TEXT NOT NULL,
  expira_em   TEXT NOT NULL,
  aceito_em   TEXT,
  aceito_por  TEXT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_invites_tenant ON invites(tenant_id);
