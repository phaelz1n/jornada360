/* Log do servidor.
 *
 * Em PRODUÇÃO sai como JSON, uma linha por evento. Não é preciosismo: é o que permite a um
 * agregador de logs (Grafana Loki, CloudWatch, Papertrail — qualquer um) filtrar por nível, por
 * rota ou por tempo de resposta sem alguém escrever expressão regular em cima de texto livre.
 *
 * Em DESENVOLVIMENTO sai legível, porque quem lê é uma pessoa numa janela de terminal.
 *
 * O QUE NUNCA ENTRA NO LOG — e a razão de cada um:
 *   - senha, token de sessão, código de convite ou de recuperação: log costuma ser guardado por
 *     mais tempo, em mais lugares e com menos controle de acesso do que o banco;
 *   - corpo de requisição: é onde os dados pessoais dos colaboradores viajam;
 *   - a URL de SMTP: ela contém a senha do provedor de e-mail. */
const PRODUCAO = process.env.NODE_ENV === 'production';

const CORES = { info: '\x1b[36m', aviso: '\x1b[33m', erro: '\x1b[31m', reset: '\x1b[0m' };

function escrever(nivel, mensagem, dados = {}) {
  if (PRODUCAO) {
    const linha = JSON.stringify({ ts: new Date().toISOString(), nivel, mensagem, ...dados });
    (nivel === 'erro' ? process.stderr : process.stdout).write(linha + '\n');
    return;
  }

  const extras = Object.keys(dados).length
    ? ' ' + Object.entries(dados).map(([k, v]) => `${k}=${v}`).join(' ')
    : '';
  const fluxo = nivel === 'erro' ? process.stderr : process.stdout;
  fluxo.write(`${CORES[nivel]}[jornada360]${CORES.reset} ${mensagem}${extras}\n`);
}

export const log = {
  info: (mensagem, dados) => escrever('info', mensagem, dados),
  aviso: (mensagem, dados) => escrever('aviso', mensagem, dados),
  erro: (mensagem, dados) => escrever('erro', mensagem, dados),
};

/* Registra cada requisição concluída: método, caminho, status e duração.
 *
 * O CAMINHO É NORMALIZADO (`/api/tenants/:id/setores`, não o id real) por dois motivos: o id de um
 * tenant no log é um identificador de cliente espalhado por um arquivo que muita gente lê, e
 * agrupar por rota é o que torna a métrica útil ("quanto tempo leva carregar uma empresa?").
 *
 * A duração é o que permite perceber degradação antes de alguém reclamar. */
export function registrarRequisicoes() {
  return (req, res, next) => {
    const inicio = process.hrtime.bigint();

    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - inicio) / 1e6;
      const caminho = req.originalUrl
        .split('?')[0]
        .replace(/\/(ten|usr|inv|pwr)_[A-Za-z0-9]+/g, '/:id')
        .replace(/\/\d{4}-\d{2}-\d{2}/g, '/:data');

      /* Requisição de arquivo estático poluiria o log sem informar nada — a não ser quando falha. */
      if (!caminho.startsWith('/api') && res.statusCode < 400) return;

      const nivel = res.statusCode >= 500 ? 'erro' : res.statusCode >= 400 ? 'aviso' : 'info';
      escrever(nivel, 'requisição', {
        metodo: req.method,
        caminho,
        status: res.statusCode,
        ms: Math.round(ms),
      });
    });

    next();
  };
}
