/* Servidor de mentira para os testes de interface.
 *
 * POR QUE UM DUBLÊ, E NÃO O SERVIDOR DE VERDADE: estes testes verificam COMO A INTERFACE REAGE —
 * mostrar carregamento, cair na tela de login quando a sessão expira, dizer que o servidor está
 * fora do ar. Provocar cada uma dessas situações num servidor real seria lento e frágil (como
 * fazer uma sessão expirar no meio de um teste?). O comportamento do servidor de verdade já é
 * verificado por 54 testes de backend, contra as rotas reais.
 *
 * O dublê responde ao mesmo contrato do backend: mesmos caminhos, mesmos códigos de status, mesmo
 * formato de erro. Se o contrato mudar de um lado só, os testes quebram — que é o que se quer. */

export interface RespostaFalsa {
  status: number;
  corpo?: unknown;
  cabecalhos?: Record<string, string>;
}

type Manipulador = (url: string, init: RequestInit) => RespostaFalsa | undefined;

const rotas: Manipulador[] = [];
export const chamadas: { metodo: string; url: string; corpo: unknown; cabecalhos: Record<string, string> }[] = [];

export function responder(manipulador: Manipulador) {
  rotas.unshift(manipulador);
}

export function limparServidorFalso() {
  rotas.length = 0;
  chamadas.length = 0;
}

/* Instala o dublê no lugar de `fetch`. Tudo que o cliente de API faz passa por aqui. */
export function instalarServidorFalso() {
  limparServidorFalso();

  /* Cadastro aberto é o padrão do dublê porque é o padrão do servidor em desenvolvimento. Os
   * testes que verificam o programa piloto sobrescrevem esta rota com `responder(...)`, que entra
   * na frente da lista. */
  responder((url) => (url.includes('/api/auth/modo') ? { status: 200, corpo: { cadastroAberto: true } } : undefined));

  globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof entrada === 'string' ? entrada : entrada.toString();
    const cabecalhos = (init.headers ?? {}) as Record<string, string>;
    chamadas.push({
      metodo: init.method ?? 'GET',
      url,
      corpo: init.body ? JSON.parse(String(init.body)) : undefined,
      cabecalhos,
    });

    for (const rota of rotas) {
      const r = rota(url, init);
      if (r) {
        const texto = r.corpo === undefined ? '' : JSON.stringify(r.corpo);
        return new Response(texto, {
          status: r.status,
          headers: { 'content-type': 'application/json', ...(r.cabecalhos ?? {}) },
        });
      }
    }

    /* Nenhuma rota atendeu: 404, igual ao servidor real. Um teste que esqueceu de declarar uma
     * rota vê um erro claro em vez de uma promessa pendurada. */
    return new Response(JSON.stringify({ erro: 'nao_encontrado', mensagem: 'Recurso não encontrado.' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
}

/* Simula queda de rede — o `fetch` rejeita, que é o único caso em que ele rejeita de verdade. */
export function servidorForaDoAr() {
  globalThis.fetch = (async () => {
    throw new TypeError('Failed to fetch');
  }) as typeof fetch;
}

/* ---------------------------------------------------------------- respostas prontas */

export const USUARIO = { id: 'usr-1', email: 'ana@empresa.test', nome: 'Ana Analista' };

export const PERMISSOES_ADMIN = [
  'config:ler', 'config:escrever', 'usuarios:gerir', 'dados:ler', 'dados:escrever',
  'pendencia:ler', 'pendencia:tratar', 'pendencia:revisar', 'auditoria:ler',
  'relatorio:exportar', 'tenant:excluir',
];

export function tenant(
  over: Partial<{ id: string; nome: string; papel: string; permissoes: string[]; status: 'ativa' | 'suspensa' }> = {},
) {
  return {
    id: 'ten-1',
    nome: 'Empresa Alpha',
    environment: 'real' as const,
    papel: 'administrador',
    permissoes: PERMISSOES_ADMIN,
    ...over,
  };
}

export function cadastro(over: Record<string, unknown> = {}) {
  return {
    id: 'ten-1',
    nome: 'Empresa Alpha',
    criadoEm: '2026-08-01T00:00:00.000Z',
    environment: 'real',
    papel: 'administrador',
    permissoes: PERMISSOES_ADMIN,
    versao: 'v1',
    company: { nome: 'Empresa Alpha', cnpj: '', identificacao: '', logoUrl: '', status: 'ativo' },
    units: [],
    departments: [],
    schedules: [],
    employees: [],
    integrations: [],
    users: [],
    rules: {
      toleranceMin: 10, dailyGoalMin: 0, recurrenceLimit: 5, intervalMinMin: 60,
      interjourneyMinHours: 11, prazoPadraoDias: 3, alertaAntecedenciaDias: 1,
    },
    causaOpts: [],
    ...over,
  };
}

/* Cenário padrão: servidor no ar, usuário autenticado, uma empresa vazia. É o ponto de partida da
 * maioria dos testes; cada um sobrescreve só o que precisa. */
export function cenarioAutenticado(opcoes: { cadastro?: Record<string, unknown>; tenants?: unknown[] } = {}) {
  instalarServidorFalso();

  responder((url) => (url.includes('/api/saude') ? { status: 200, corpo: { ok: true } } : undefined));
  responder((url) =>
    url.includes('/api/auth/eu')
      ? { status: 200, corpo: { usuario: USUARIO, tenants: opcoes.tenants ?? [tenant()] } }
      : undefined,
  );
  responder((url) => (url.endsWith('/dias?completo=1') ? { status: 200, corpo: [] } : undefined));
  responder((url) => (url.endsWith('/pendencias') ? { status: 200, corpo: [] } : undefined));
  responder((url) => (url.endsWith('/auditoria') ? { status: 200, corpo: [] } : undefined));
  responder((url, init) =>
    /\/api\/tenants\/[^/]+$/.test(url) && (init.method ?? 'GET') === 'GET'
      ? { status: 200, corpo: cadastro(opcoes.cadastro), cabecalhos: { 'x-versao': 'v1' } }
      : undefined,
  );
}
