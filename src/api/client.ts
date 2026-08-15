/* Cliente HTTP da API do Jornada360.
 *
 * É o ÚNICO lugar do frontend que chama `fetch`. Nenhuma tela e nenhum service falam com a rede
 * diretamente — a mesma regra que já valia para `localStorage` vale aqui. Trocar o transporte
 * (REST → GraphQL, por exemplo) é reescrever este arquivo, e só ele.
 *
 * Também centraliza o que dá errado: token expirado, servidor fora do ar e erro de permissão
 * viram tipos de erro que a interface sabe apresentar, em vez de um stack trace vazando na tela.
 *
 * SESSÃO (Fase 4) — mudança importante em relação à Fase 3
 * -------------------------------------------------------
 * O token NÃO é mais guardado em `localStorage`, e o JavaScript da página não o vê em momento
 * nenhum. A sessão vive num cookie `HttpOnly` definido pelo servidor: um script malicioso na
 * página não consegue lê-lo nem copiá-lo para outra máquina.
 *
 * Para isso funcionar, página e API precisam ser da MESMA ORIGEM. Em desenvolvimento é o proxy do
 * Vite que garante isso (`/api` → localhost:3333, ver vite.config.ts); em produção, o mesmo
 * domínio serve os dois. Por isso `BASE` é vazio por padrão: as requisições saem relativas.
 *
 * `credentials: 'include'` faz o navegador anexar o cookie; `x-jornada-cliente: web` é a proteção
 * contra CSRF exigida pelo servidor em toda requisição que altera estado. */

const BASE = import.meta.env.VITE_API_URL || '';

export type TipoErroApi =
  | 'rede'          // servidor inalcançável — API fora do ar ou sem internet
  | 'sessao'        // 401: sessão inválida ou expirada
  | 'permissao'     // 403: papel sem permissão para a ação
  | 'nao_encontrado'// 404: recurso inexistente OU de outro tenant (indistinguível de propósito)
  | 'validacao'     // 400: entrada rejeitada pelo servidor
  | 'conflito'      // 409: alguém alterou o registro no meio do caminho
  | 'limite'        // 429: muitas tentativas
  | 'servidor';     // 5xx

export class ErroApi extends Error {
  readonly tipo: TipoErroApi;
  readonly status: number;
  /** Presente em conflito: o carimbo que o servidor tem agora. */
  readonly versaoAtual?: string;

  constructor(tipo: TipoErroApi, mensagem: string, status = 0, versaoAtual?: string) {
    super(mensagem);
    this.name = 'ErroApi';
    this.tipo = tipo;
    this.status = status;
    this.versaoAtual = versaoAtual;
  }
}

/* Mensagens prontas para exibição. O usuário nunca deve ver "TypeError: Failed to fetch". */
export const MENSAGEM_PADRAO: Record<TipoErroApi, string> = {
  rede: 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
  sessao: 'Sua sessão expirou. Entre novamente para continuar.',
  permissao: 'Seu perfil de acesso não permite esta ação.',
  nao_encontrado: 'O item solicitado não foi encontrado.',
  validacao: 'Os dados informados não foram aceitos.',
  conflito: 'Alguém alterou este registro enquanto você editava. Recarregue para ver a versão atual.',
  limite: 'Muitas tentativas seguidas. Aguarde um momento antes de tentar de novo.',
  servidor: 'O servidor não conseguiu concluir a operação. Tente novamente em instantes.',
};

/* Quem quiser reagir globalmente a uma sessão que caiu se inscreve aqui — é assim que o
 * AuthProvider consegue derrubar a sessão a partir de QUALQUER requisição que receba 401, sem que
 * cada chamada precise tratar isso. */
type OuvinteSessao = () => void;
const ouvintesSessaoExpirada = new Set<OuvinteSessao>();

export function aoExpirarSessao(ouvinte: OuvinteSessao): () => void {
  ouvintesSessaoExpirada.add(ouvinte);
  return () => ouvintesSessaoExpirada.delete(ouvinte);
}

function tipoPorStatus(status: number): TipoErroApi {
  if (status === 401) return 'sessao';
  if (status === 403) return 'permissao';
  if (status === 404) return 'nao_encontrado';
  if (status === 409) return 'conflito';
  if (status === 429) return 'limite';
  if (status === 400) return 'validacao';
  return 'servidor';
}

export interface OpcoesRequisicao {
  /** Carimbo de versão lido antes de editar. O servidor recusa a gravação se já mudou. */
  versao?: string;
  /** Devolve o cabeçalho `x-versao` da resposta junto com o corpo. */
  comVersao?: boolean;
}

export interface RespostaComVersao<T> {
  dados: T;
  versao: string;
}

async function requisitar<T>(
  metodo: string,
  caminho: string,
  corpo?: unknown,
  opcoes: OpcoesRequisicao = {},
): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(BASE + caminho, {
      method: metodo,
      /* Sem isto o navegador não envia o cookie de sessão. */
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        /* Cabeçalho que só código de mesma origem consegue definir — é a barreira anti-CSRF
         * exigida pelo servidor (ver server/lib/sessaoHttp.js). */
        'x-jornada-cliente': 'web',
        ...(opcoes.versao ? { 'x-versao': opcoes.versao } : {}),
      },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
  } catch {
    /* `fetch` só rejeita por falha de rede — erro HTTP vem como resposta. */
    throw new ErroApi('rede', MENSAGEM_PADRAO.rede);
  }

  const versao = resposta.headers.get('x-versao') ?? '';

  if (resposta.status === 204) {
    return (opcoes.comVersao ? { dados: undefined, versao } : undefined) as T;
  }

  const texto = await resposta.text();
  let dados: { mensagem?: string; versaoAtual?: string } | null = null;
  try {
    dados = texto ? JSON.parse(texto) : null;
  } catch {
    /* Resposta que não é JSON só acontece quando algo entre o navegador e a API respondeu no
     * lugar dela (proxy, página de erro). Tratar como falha de servidor é mais honesto do que
     * deixar o `JSON.parse` estourar com uma mensagem que não diz nada. */
    throw new ErroApi('servidor', MENSAGEM_PADRAO.servidor, resposta.status);
  }

  if (!resposta.ok) {
    const tipo = tipoPorStatus(resposta.status);
    if (tipo === 'sessao') {
      for (const ouvinte of ouvintesSessaoExpirada) ouvinte();
    }
    throw new ErroApi(tipo, dados?.mensagem || MENSAGEM_PADRAO[tipo], resposta.status, dados?.versaoAtual);
  }

  return (opcoes.comVersao ? { dados, versao } : dados) as T;
}

export const api = {
  get: <T>(caminho: string, opcoes?: OpcoesRequisicao) => requisitar<T>('GET', caminho, undefined, opcoes),
  post: <T>(caminho: string, corpo?: unknown, opcoes?: OpcoesRequisicao) => requisitar<T>('POST', caminho, corpo, opcoes),
  put: <T>(caminho: string, corpo?: unknown, opcoes?: OpcoesRequisicao) => requisitar<T>('PUT', caminho, corpo, opcoes),
  patch: <T>(caminho: string, corpo?: unknown, opcoes?: OpcoesRequisicao) => requisitar<T>('PATCH', caminho, corpo, opcoes),
  delete: <T>(caminho: string, opcoes?: OpcoesRequisicao) => requisitar<T>('DELETE', caminho, undefined, opcoes),
};

/* Verifica se a API está no ar. Usado para decidir entre o modo local (demonstração) e o modo
 * conectado, sem quebrar quem roda só o frontend. O tempo limite é curto de propósito: esta
 * checagem acontece na abertura do app e não pode segurar a primeira tela. */
export async function apiDisponivel(): Promise<boolean> {
  try {
    const controle = new AbortController();
    const t = setTimeout(() => controle.abort(), 2500);
    const r = await fetch(`${BASE}/api/saude`, { signal: controle.signal, credentials: 'include' });
    clearTimeout(t);
    return r.ok;
  } catch {
    return false;
  }
}
