/* Contas de acesso e sessões. Único lugar que toca as tabelas `users` e `sessions`. */
import { abrirBanco } from '../db/index.js';
import { novoId, hashSenha, verificarSenha, gerarToken, hashToken } from '../lib/seguranca.js';

/* Duração da sessão. 12h é conservador para um sistema de RH: longo o bastante para cobrir um
 * turno de trabalho sem reautenticar, curto o bastante para que uma máquina esquecida aberta não
 * fique acessível indefinidamente. */
const HORAS_SESSAO = 12;

export function criarUsuario({ email, nome, senha }) {
  const db = abrirBanco();
  const id = novoId('usr');
  db.prepare('INSERT INTO users (id, email, nome, password_hash, criado_em, ativo) VALUES (?, ?, ?, ?, ?, 1)')
    .run(id, email.toLowerCase().trim(), nome.trim(), hashSenha(senha), new Date().toISOString());
  return { id, email: email.toLowerCase().trim(), nome: nome.trim() };
}

export function buscarPorEmail(email) {
  return abrirBanco().prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim()) ?? null;
}

export function buscarUsuario(id) {
  return abrirBanco().prepare('SELECT id, email, nome, ativo FROM users WHERE id = ?').get(id) ?? null;
}

/* Autentica e devolve o usuário, ou null.
 *
 * Devolve `null` genérico tanto para e-mail inexistente quanto para senha errada: distinguir os
 * dois casos na resposta permitiria enumerar quais e-mails têm conta no sistema. */
export function autenticar(email, senha) {
  const u = buscarPorEmail(email);
  if (!u || !u.ativo) return null;
  if (!verificarSenha(senha, u.password_hash)) return null;
  return { id: u.id, email: u.email, nome: u.nome };
}

/* Cria a sessão e devolve o token CRU — é a única vez que ele existe fora do cliente. O banco
 * guarda apenas o hash. */
export function criarSessao(userId) {
  const db = abrirBanco();
  const token = gerarToken();
  const agora = new Date();
  const expira = new Date(agora.getTime() + HORAS_SESSAO * 3600_000);

  db.prepare('INSERT INTO sessions (id, token_hash, user_id, criado_em, expira_em) VALUES (?, ?, ?, ?, ?)')
    .run(novoId('ses'), hashToken(token), userId, agora.toISOString(), expira.toISOString());

  return { token, expiraEm: expira.toISOString() };
}

/* Resolve o token numa sessão válida. Sessão expirada é APAGADA na hora, em vez de apenas
 * ignorada — evita acúmulo de lixo e garante que um token vencido nunca reviva. */
export function sessaoValida(token) {
  if (!token) return null;
  const db = abrirBanco();
  const s = db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(hashToken(token));
  if (!s) return null;

  if (new Date(s.expira_em) <= new Date()) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(s.id);
    return null;
  }

  const u = buscarUsuario(s.user_id);
  if (!u || !u.ativo) return null;
  return { sessaoId: s.id, usuario: { id: u.id, email: u.email, nome: u.nome } };
}

export function encerrarSessao(token) {
  if (!token) return;
  abrirBanco().prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
}

/* Troca a senha e ENCERRA TODAS AS SESSÕES da conta.
 *
 * As duas coisas juntas, de propósito: se a pessoa está trocando a senha porque alguém entrou na
 * conta dela, manter as sessões abertas anularia o esforço — o invasor continuaria dentro. */
export function trocarSenha(userId, novaSenha) {
  const db = abrirBanco();
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashSenha(novaSenha), userId);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

export function limparSessoesExpiradas() {
  abrirBanco().prepare('DELETE FROM sessions WHERE expira_em <= ?').run(new Date().toISOString());
}
