-- Migration 3 — Fase 5: recuperação de senha.
--
-- Acrescenta apenas. Nada é recriado nem apagado.

-- Pedido de redefinição de senha.
--
-- Guarda o HASH do token, nunca o token — mesma razão da senha, do token de sessão e do código de
-- convite: vazar o banco não pode entregar credencial utilizável.
--
-- `usado_em` existe para que o link seja de uso único. Sem isso, um link vazado de uma caixa de
-- e-mail antiga continuaria valendo até expirar.
CREATE TABLE IF NOT EXISTS password_resets (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  criado_em   TEXT NOT NULL,
  expira_em   TEXT NOT NULL,
  usado_em    TEXT,
  -- Guardado só para a trilha: de onde partiu o pedido. Não é usado em nenhuma decisão.
  origem_ip   TEXT
);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);
