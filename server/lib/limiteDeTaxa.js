/* Limite de tentativas por janela deslizante, em memória.
 *
 * ESCOPO HONESTO: protege UM processo. Com várias instâncias atrás de um balanceador, cada uma tem
 * o próprio contador e o limite efetivo se multiplica. Para o estágio atual (processo único) isso é
 * suficiente e não acrescenta dependência; um deploy com múltiplas instâncias precisa trocar o
 * armazenamento por Redis ou equivalente — está registrado em SECURITY.md.
 *
 * O que ele impede de verdade: força bruta de senha e criação de contas em massa a partir de um
 * mesmo endereço. O que ele NÃO impede: um atacante distribuído. Também não é substituto de senha
 * forte nem de bloqueio de conta — é a primeira barreira, não a única.
 *
 * Em ambiente de teste o limite é propositalmente altíssimo: uma suíte que cria dezenas de contas
 * em segundos esbarraria no limite e falharia por motivo que não é o do teste. */

const registros = new Map();

function ambienteDeTeste() {
  return process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
}

/* Chave por IP + rota. Sem o `req.ip` confiável atrás de proxy, `trust proxy` precisa estar
 * configurado no deploy — senão todo mundo divide o mesmo balde (ver DEPLOY.md). */
function chave(req, nome) {
  return `${nome}::${req.ip || req.socket?.remoteAddress || 'desconhecido'}`;
}

export function limitar({ nome, maximo, janelaMs, mensagem }) {
  return (req, res, next) => {
    if (ambienteDeTeste()) return next();

    const agora = Date.now();
    const k = chave(req, nome);
    const anteriores = (registros.get(k) || []).filter((t) => agora - t < janelaMs);

    if (anteriores.length >= maximo) {
      const esperaSeg = Math.ceil((janelaMs - (agora - anteriores[0])) / 1000);
      res.set('Retry-After', String(esperaSeg));
      return res.status(429).json({
        erro: 'muitas_tentativas',
        mensagem: mensagem || `Muitas tentativas. Tente novamente em ${esperaSeg} segundo(s).`,
      });
    }

    anteriores.push(agora);
    registros.set(k, anteriores);
    next();
  };
}

/* Evita que o Map cresça para sempre num processo de vida longa. */
export function limparRegistrosExpirados(janelaMs = 15 * 60 * 1000) {
  const agora = Date.now();
  for (const [k, marcas] of registros) {
    const vivas = marcas.filter((t) => agora - t < janelaMs);
    if (vivas.length === 0) registros.delete(k);
    else registros.set(k, vivas);
  }
}

/* Só para os testes: zera o estado entre cenários. */
export function _limparTudo() {
  registros.clear();
}
