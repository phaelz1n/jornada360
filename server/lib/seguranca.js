/* Primitivas de segurança — hash de senha e tokens de sessão.
 *
 * Usa `node:crypto` (scrypt), não bcrypt/argon2. Motivo: scrypt é uma função de derivação de
 * chave projetada exatamente para senhas (custo de memória alto, resistente a GPU), está embutida
 * no Node, e evita uma dependência com compilação nativa. É a escolha conservadora aqui.
 *
 * NADA neste arquivo aceita ou devolve senha em texto puro além do ponto de comparação. */
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';

/* Parâmetros do scrypt. N=16384 é o padrão recomendado para uso interativo: alguns milissegundos
 * por verificação, caro o bastante para tornar força bruta inviável. */
const N = 16384;
const R = 8;
const P = 1;
const TAMANHO_HASH = 64;

export function hashSenha(senha) {
  const salt = randomBytes(16);
  const hash = scryptSync(senha, salt, TAMANHO_HASH, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${R}$${P}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

/* Comparação em tempo constante: comparar com `===` vazaria informação pelo tempo de resposta,
 * permitindo descobrir o hash caractere a caractere. */
export function verificarSenha(senha, armazenado) {
  try {
    const [algoritmo, n, r, p, saltHex, hashHex] = armazenado.split('$');
    if (algoritmo !== 'scrypt') return false;

    const salt = Buffer.from(saltHex, 'hex');
    const esperado = Buffer.from(hashHex, 'hex');
    const calculado = scryptSync(senha, salt, esperado.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 64 * 1024 * 1024,
    });
    return timingSafeEqual(esperado, calculado);
  } catch {
    return false;
  }
}

/* Token de sessão: 32 bytes aleatórios. O valor cru vai para o cliente uma única vez; o banco
 * guarda apenas o hash — vazar o banco não deve entregar sessões utilizáveis.
 *
 * SHA-256 sem salt é adequado AQUI (e só aqui): o token já tem 256 bits de entropia, então não há
 * o que uma rainbow table pré-computasse. Senha é diferente e por isso usa scrypt. */
export function gerarToken() {
  return randomBytes(32).toString('hex');
}

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function novoId(prefixo) {
  return `${prefixo}_${randomBytes(9).toString('hex')}`;
}
