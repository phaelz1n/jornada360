-- Migration 4 — Programa Piloto.
--
-- Acrescenta apenas. Nada é recriado nem apagado.
--
-- Duas necessidades concretas do piloto, e nada além:
--   1. controlar QUAIS empresas têm acesso, podendo suspender e reativar SEM perder dados;
--   2. registrar o feedback dos primeiros clientes, que é o que define as próximas versões.

-- Situação da empresa no programa.
--
-- 'ativa'    — uso normal.
-- 'suspensa' — o acesso aos dados é recusado, mas TUDO É PRESERVADO. É a diferença entre
--              suspender e excluir: suspender é reversível, excluir não. Numa cobrança manual,
--              suspender é a única ação aceitável enquanto a conversa com o cliente estiver aberta.
ALTER TABLE tenants ADD COLUMN status TEXT NOT NULL DEFAULT 'ativa';

-- Quando e por quê. Guardado para que a decisão continue explicável meses depois — e para que a
-- mensagem mostrada ao cliente possa ser específica em vez de um "acesso negado" seco.
ALTER TABLE tenants ADD COLUMN suspensa_em TEXT;
ALTER TABLE tenants ADD COLUMN motivo_suspensao TEXT;

-- Anotação livre do operador do piloto (contato, data de início, combinado comercial).
-- Nunca é exibida ao cliente.
ALTER TABLE tenants ADD COLUMN nota_piloto TEXT;

-- Feedback dos clientes piloto.
--
-- Fica no MESMO banco, com tenant_id, por dois motivos: é dado da empresa como qualquer outro
-- (entra no backup junto, sem um segundo lugar para lembrar de copiar), e a origem do relato
-- importa tanto quanto o conteúdo — "duas empresas diferentes relataram a mesma dificuldade" é
-- uma informação de produto muito mais forte que "alguém relatou".
CREATE TABLE IF NOT EXISTS feedback (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- Quem relatou vem da SESSÃO, nunca do corpo — mesma regra da auditoria.
  user_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  usuario    TEXT NOT NULL,
  -- erro | dificuldade | sugestao | funcionalidade | duvida
  categoria  TEXT NOT NULL,
  mensagem   TEXT NOT NULL,
  -- Em que tela a pessoa estava. Um relato sem contexto costuma custar uma ida e volta inteira
  -- só para descobrir onde aconteceu.
  tela       TEXT NOT NULL DEFAULT '',
  criado_em  TEXT NOT NULL,
  -- Acompanhamento pelo operador: aberto | lido | resolvido | descartado.
  -- 'descartado' existe de propósito: nem toda sugestão vira funcionalidade, e registrar a
  -- decisão de NÃO fazer é tão útil quanto registrar a de fazer.
  situacao   TEXT NOT NULL DEFAULT 'aberto',
  nota_interna TEXT
);
CREATE INDEX IF NOT EXISTS idx_feedback_tenant ON feedback(tenant_id);
CREATE INDEX IF NOT EXISTS idx_feedback_situacao ON feedback(situacao);
