/* Transporte da sessão pelo HTTP: cookie (navegador) e Bearer (cliente de API).
 *
 * POR QUE COOKIE, E NÃO TOKEN NO localStorage
 * -------------------------------------------
 * Na Fase 3 o token vivia em `localStorage`. Isso significa que QUALQUER script que consiga
 * executar na página — uma dependência comprometida, um XSS — consegue ler a sessão e usá-la de
 * outra máquina. Um cookie `HttpOnly` não é legível por JavaScript: o mesmo XSS ainda pode fazer
 * requisições em nome da vítima enquanto a aba está aberta, mas não consegue LEVAR a sessão embora.
 * É uma diferença real, não cosmética.
 *
 * O que o cookie exige em troca: mesma origem entre página e API. É por isso que o Vite passou a
 * fazer proxy de `/api` (ver vite.config.ts) — o navegador enxerga tudo em localhost:5173, o cookie
 * é first-party, e `SameSite=Lax` funciona sem HTTPS em desenvolvimento. Em produção a mesma
 * topologia se mantém (frontend e API atrás do mesmo domínio) e `Secure` é ligado.
 *
 * CSRF
 * ----
 * Cookie é enviado automaticamente pelo navegador — é justamente isso que abre espaço para CSRF.
 * A proteção aqui é exigir um cabeçalho próprio (`x-jornada-cliente: web`) em toda requisição que
 * ALTERA estado e que se autenticou por cookie. Um formulário ou <img> de outro site não consegue
 * definir cabeçalho customizado sem passar por preflight de CORS, que a lista de origens recusa.
 *
 * Requisições autenticadas por Bearer não precisam do cabeçalho: um token que o cliente anexa à
 * mão não é enviado sozinho pelo navegador, então não existe o vetor. */

export const COOKIE_SESSAO = 'jornada360_sessao';

/* Cookie seguro é obrigatório em produção e impossível em desenvolvimento sem HTTPS — um cookie
 * `Secure` simplesmente não é gravado em http://localhost, e o login pareceria "não funcionar". */
function cookieSeguro() {
  return process.env.JORNADA_COOKIE_SEGURO === '1' || process.env.NODE_ENV === 'production';
}

export function lerCookies(req) {
  const bruto = req.headers.cookie;
  if (!bruto) return {};
  const saida = {};
  for (const parte of bruto.split(';')) {
    const i = parte.indexOf('=');
    if (i < 0) continue;
    saida[parte.slice(0, i).trim()] = decodeURIComponent(parte.slice(i + 1).trim());
  }
  return saida;
}

export function definirCookieSessao(res, token, expiraEm) {
  const segundos = Math.max(0, Math.floor((new Date(expiraEm).getTime() - Date.now()) / 1000));
  const partes = [
    `${COOKIE_SESSAO}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${segundos}`,
  ];
  if (cookieSeguro()) partes.push('Secure');
  res.append('Set-Cookie', partes.join('; '));
}

export function limparCookieSessao(res) {
  const partes = [`${COOKIE_SESSAO}=`, 'HttpOnly', 'Path=/', 'SameSite=Lax', 'Max-Age=0'];
  if (cookieSeguro()) partes.push('Secure');
  res.append('Set-Cookie', partes.join('; '));
}

/* Devolve o token e COMO ele chegou — a origem importa para decidir se a proteção CSRF se aplica. */
export function tokenDaRequisicao(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return { token: header.slice(7), origem: 'bearer' };

  const doCookie = lerCookies(req)[COOKIE_SESSAO];
  if (doCookie) return { token: doCookie, origem: 'cookie' };

  return { token: null, origem: 'nenhuma' };
}

const METODOS_QUE_ALTERAM = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function exigeCabecalhoAntiCsrf(req, origem) {
  return origem === 'cookie' && METODOS_QUE_ALTERAM.has(req.method);
}

export function temCabecalhoAntiCsrf(req) {
  return req.headers['x-jornada-cliente'] === 'web';
}

/* O token só volta no CORPO da resposta para quem se identifica como cliente de API (testes, curl,
 * integração servidor-a-servidor). Um navegador recebe apenas o cookie: se o token não chega ao
 * JavaScript, nenhum script consegue copiá-lo. */
export function clienteQuerToken(req) {
  return req.headers['x-jornada-cliente'] === 'api';
}
