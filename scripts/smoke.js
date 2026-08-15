#!/usr/bin/env node
/* Verificação pós-deploy — roda CONTRA A URL PUBLICADA.
 *
 *   npm run smoke -- https://jornada360.seudominio.com.br
 *
 * Por que existir, se já há 275 testes: eles provam que o CÓDIGO funciona. Este prova que o
 * DEPLOY funciona — HTTPS de verdade, cookie chegando com os atributos certos, frontend sendo
 * servido, banco persistindo, isolamento valendo em produção. São coisas que só quebram no
 * ambiente, e que nenhum teste de unidade alcança.
 *
 * Ele cria duas contas de teste reais. Ao final, avisa quais são para você removê-las (ou
 * simplesmente ignorá-las: não interferem em nada).
 *
 * Sai com código 0 apenas se TUDO passar — pode ser usado no fim de um pipeline de deploy. */

const base = (process.argv[2] || '').replace(/\/$/, '');

if (!base) {
  console.error('\nUso: npm run smoke -- https://seu-dominio.com.br\n');
  process.exit(1);
}

const marca = Date.now();
const CONTA_A = { email: `smoke-a-${marca}@teste.local`, nome: 'Smoke A', senha: 'smoke-teste-2026', nomeEmpresa: `Smoke Alpha ${marca}` };
const CONTA_B = { email: `smoke-b-${marca}@teste.local`, nome: 'Smoke B', senha: 'smoke-teste-2026', nomeEmpresa: `Smoke Beta ${marca}` };

let passou = 0;
let falhou = 0;
const avisos = [];

function ok(nome, detalhe = '') {
  passou += 1;
  console.log(`  ✓ ${nome}${detalhe ? `  ${detalhe}` : ''}`);
}
function nok(nome, motivo) {
  falhou += 1;
  console.log(`  ✗ ${nome}\n      ${motivo}`);
}
function aviso(nome, motivo) {
  avisos.push(`${nome}: ${motivo}`);
  console.log(`  ! ${nome}\n      ${motivo}`);
}
function secao(titulo) {
  console.log(`\n${titulo}`);
}

/* Cliente com cookie, como um navegador. É assim que a sessão precisa funcionar em produção. */
function criarCliente() {
  const cookies = new Map();
  return {
    cookies,
    async req(metodo, caminho, corpo, extras = {}) {
      const enviar = [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');
      const r = await fetch(base + caminho, {
        method: metodo,
        redirect: 'manual',
        headers: {
          'content-type': 'application/json',
          'x-jornada-cliente': 'web',
          ...(enviar ? { cookie: enviar } : {}),
          ...extras,
        },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
      });

      for (const bruto of r.headers.getSetCookie?.() ?? []) {
        const [par] = bruto.split(';');
        const i = par.indexOf('=');
        const nome = par.slice(0, i).trim();
        const valor = par.slice(i + 1).trim();
        if (valor === '') cookies.delete(nome);
        else cookies.set(nome, valor);
        if (nome === 'jornada360_sessao') this.ultimoSetCookie = bruto;
      }

      const texto = await r.text();
      let json = null;
      try {
        json = texto ? JSON.parse(texto) : null;
      } catch {
        json = null;
      }
      return { status: r.status, corpo: json, texto, headers: r.headers };
    },
  };
}

console.log(`\nVerificando o deploy em ${base}\n${'─'.repeat(60)}`);

/* ---------------------------------------------------------------- 1. transporte */

secao('1. Transporte e disponibilidade');

if (base.startsWith('https://')) {
  ok('HTTPS', 'a URL usa https');
} else if (base.includes('localhost') || base.includes('127.0.0.1')) {
  aviso('HTTPS', 'rodando em localhost — aceitável em ensaio, INACEITÁVEL na URL pública');
} else {
  nok('HTTPS', 'a URL pública precisa ser https://');
}

const cliente = criarCliente();

const saude = await cliente.req('GET', '/api/saude');
if (saude.status === 200 && saude.corpo?.ok) ok('API responde', `versão ${saude.corpo.versao}, no ar há ${saude.corpo.tempoNoArSegundos}s`);
else nok('API responde', `status ${saude.status}`);

/* Redirecionamento de http → https. Sem isso, alguém que digite o domínio sem "https" navega em
 * texto claro sem perceber. */
if (base.startsWith('https://')) {
  try {
    const r = await fetch(base.replace('https://', 'http://'), { redirect: 'manual' });
    if (r.status >= 300 && r.status < 400 && (r.headers.get('location') || '').startsWith('https://')) {
      ok('http redireciona para https');
    } else {
      nok('http redireciona para https', `recebido status ${r.status}`);
    }
  } catch {
    aviso('http redireciona para https', 'porta 80 inacessível — verifique se o proxy está publicado');
  }
}

const hsts = saude.headers.get('strict-transport-security');
if (hsts) ok('Strict-Transport-Security', hsts);
else if (base.startsWith('https://')) nok('Strict-Transport-Security', 'ausente');

for (const [cabecalho, esperado] of [['x-content-type-options', 'nosniff'], ['x-frame-options', 'DENY'], ['referrer-policy', 'no-referrer']]) {
  const v = saude.headers.get(cabecalho);
  if (v === esperado) ok(`Cabeçalho ${cabecalho}`, v);
  else nok(`Cabeçalho ${cabecalho}`, `esperado "${esperado}", recebido "${v}"`);
}

/* ---------------------------------------------------------------- 2. frontend */

secao('2. Frontend servido');

const pagina = await cliente.req('GET', '/');
if (pagina.status === 200 && /<div id="root">/.test(pagina.texto)) ok('página inicial responde', 'HTML do Jornada360');
else nok('página inicial responde', `status ${pagina.status}`);

/* Recarregar direto numa rota interna precisa funcionar — senão o cliente que salva um favorito
 * em /pendencias recebe 404. */
const rotaInterna = await cliente.req('GET', '/entrar');
if (rotaInterna.status === 200 && /<div id="root">/.test(rotaInterna.texto)) ok('rota interna recarrega', '/entrar devolve o app');
else nok('rota interna recarrega', `status ${rotaInterna.status}`);

const apiInexistente = await cliente.req('GET', '/api/nao-existe');
if (apiInexistente.status === 404 && apiInexistente.corpo?.erro) ok('rota de API inexistente devolve JSON', 'não devolve a página');
else nok('rota de API inexistente devolve JSON', `status ${apiInexistente.status}`);

/* ---------------------------------------------------------------- 3. conta e sessão */

secao('3. Conta, sessão e cookie');

const registro = await cliente.req('POST', '/api/auth/registrar', CONTA_A);
if (registro.status === 201) ok('criar conta e empresa', CONTA_A.nomeEmpresa);
else nok('criar conta e empresa', `status ${registro.status}: ${registro.corpo?.mensagem ?? registro.texto.slice(0, 120)}`);

if (registro.corpo?.token === undefined) ok('token NÃO volta no corpo', 'navegador recebe só o cookie');
else nok('token NÃO volta no corpo', 'o token apareceu na resposta de um cliente web');

const setCookie = cliente.ultimoSetCookie ?? '';
if (/HttpOnly/i.test(setCookie)) ok('cookie HttpOnly', 'JavaScript não lê a sessão');
else nok('cookie HttpOnly', `recebido: ${setCookie.slice(0, 90)}`);

if (/SameSite=Lax/i.test(setCookie)) ok('cookie SameSite=Lax');
else nok('cookie SameSite=Lax', `recebido: ${setCookie.slice(0, 90)}`);

if (base.startsWith('https://')) {
  if (/;\s*Secure/i.test(setCookie)) ok('cookie Secure');
  else nok('cookie Secure', 'em HTTPS o cookie DEVE ter Secure — verifique JORNADA_COOKIE_SEGURO');
}

const tenantA = registro.corpo?.tenants?.[0]?.id;
const eu = await cliente.req('GET', '/api/auth/eu');
if (eu.status === 200 && eu.corpo?.usuario?.email === CONTA_A.email) ok('sessão pelo cookie', eu.corpo.usuario.nome);
else nok('sessão pelo cookie', `status ${eu.status}`);

/* ---------------------------------------------------------------- 4. CSRF */

secao('4. Proteção contra requisição forjada');

const semCabecalho = await fetch(`${base}/api/tenants/${tenantA}/setores`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', cookie: [...cliente.cookies].map(([k, v]) => `${k}=${v}`).join('; ') },
  body: JSON.stringify({ id: 'forjado', nome: 'Forjado' }),
});
if (semCabecalho.status === 403) ok('escrita sem o cabeçalho do cliente web é recusada', '403');
else nok('escrita sem o cabeçalho do cliente web é recusada', `status ${semCabecalho.status}`);

/* ---------------------------------------------------------------- 5. persistência */

secao('5. Persistência real');

const criouSetor = await cliente.req('POST', `/api/tenants/${tenantA}/setores`, { id: `set-smoke-${marca}`, nome: 'Setor do Smoke' });
if (criouSetor.status === 201) ok('gravar dado');
else nok('gravar dado', `status ${criouSetor.status}: ${criouSetor.corpo?.mensagem ?? ''}`);

await cliente.req('POST', '/api/auth/sair');
const depoisDeSair = await cliente.req('GET', '/api/auth/eu');
if (depoisDeSair.status === 401) ok('sair encerra a sessão');
else nok('sair encerra a sessão', `status ${depoisDeSair.status}`);

/* Sessão nova, cliente novo — é o equivalente a abrir noutro computador. */
const clienteNovo = criarCliente();
const entrou = await clienteNovo.req('POST', '/api/auth/entrar', { email: CONTA_A.email, senha: CONTA_A.senha });
if (entrou.status === 200) ok('entrar de novo, em sessão nova');
else nok('entrar de novo, em sessão nova', `status ${entrou.status}`);

const setores = await clienteNovo.req('GET', `/api/tenants/${tenantA}/setores`);
if (setores.status === 200 && setores.corpo?.some((s) => s.nome === 'Setor do Smoke')) {
  ok('o dado continua lá', 'persistiu entre sessões — o banco é persistente');
} else {
  nok('o dado continua lá', 'o dado gravado não foi encontrado depois de reentrar');
}

/* ---------------------------------------------------------------- 6. isolamento */

secao('6. Isolamento entre empresas');

const clienteB = criarCliente();
const registroB = await clienteB.req('POST', '/api/auth/registrar', CONTA_B);
const tenantB = registroB.corpo?.tenants?.[0]?.id;
if (registroB.status === 201) ok('segunda conta criada', CONTA_B.nomeEmpresa);
else nok('segunda conta criada', `status ${registroB.status}: ${registroB.corpo?.mensagem ?? ''}`);

const bVeAsProprias = await clienteB.req('GET', '/api/auth/eu');
if (bVeAsProprias.corpo?.tenants?.length === 1 && bVeAsProprias.corpo.tenants[0].id === tenantB) {
  ok('cada conta vê apenas a própria empresa');
} else {
  nok('cada conta vê apenas a própria empresa', JSON.stringify(bVeAsProprias.corpo?.tenants));
}

const bTentaA = await clienteB.req('GET', `/api/tenants/${tenantA}/setores`);
if (bTentaA.status === 404) ok('acesso cruzado devolve 404', 'não confirma sequer que a empresa existe');
else nok('acesso cruzado devolve 404', `status ${bTentaA.status} — VAZAMENTO`);

const bEscreveEmA = await clienteB.req('POST', `/api/tenants/${tenantA}/setores`, { id: 'invasor', nome: 'Invasor' });
if (bEscreveEmA.status === 404) ok('escrita cruzada recusada');
else nok('escrita cruzada recusada', `status ${bEscreveEmA.status} — VAZAMENTO`);

const semSessao = await fetch(`${base}/api/tenants/${tenantA}/setores`);
if (semSessao.status === 401) ok('sem sessão, 401');
else nok('sem sessão, 401', `status ${semSessao.status}`);

/* ---------------------------------------------------------------- 7. permissões */

secao('7. Permissões');

await clienteNovo.req('POST', `/api/tenants/${tenantA}/membros`, { email: CONTA_B.email, papel: 'auditor' });
const auditorLe = await clienteB.req('GET', `/api/tenants/${tenantA}/setores`);
const auditorEscreve = await clienteB.req('POST', `/api/tenants/${tenantA}/setores`, { id: 'x', nome: 'Tentativa de auditor' });

if (auditorLe.status === 200) ok('auditor lê');
else nok('auditor lê', `status ${auditorLe.status}`);

if (auditorEscreve.status === 403) ok('auditor NÃO escreve', '403 vindo do servidor');
else nok('auditor NÃO escreve', `status ${auditorEscreve.status}`);

/* ---------------------------------------------------------------- 8. recuperação de senha */

secao('8. Recuperação de senha');

const pedido = await cliente.req('POST', '/api/auth/recuperar', { email: CONTA_A.email });
if (pedido.status === 200 && pedido.corpo?.ok) ok('pedido aceito', 'resposta genérica, sem revelar se a conta existe');
else nok('pedido aceito', `status ${pedido.status}`);

const inexistente = await cliente.req('POST', '/api/auth/recuperar', { email: `nao-existe-${marca}@teste.local` });
if (inexistente.status === 200 && inexistente.corpo?.mensagem === pedido.corpo?.mensagem) {
  ok('resposta idêntica para conta inexistente', 'não serve como verificador de e-mails');
} else {
  nok('resposta idêntica para conta inexistente', 'a resposta difere — permite descobrir quem tem conta');
}

const linkInvalido = await cliente.req('GET', '/api/auth/recuperar/codigo-inventado');
if (linkInvalido.status === 400) ok('link inválido é recusado');
else nok('link inválido é recusado', `status ${linkInvalido.status}`);

/* ---------------------------------------------------------------- 9. prontidão */

secao('9. Prontidão operacional');

const prontidao = await cliente.req('GET', '/api/prontidao');
const c = prontidao.corpo?.componentes ?? {};

if (c.banco?.ok) ok('banco responde');
else nok('banco responde', c.banco?.erro ?? 'sem resposta');

if (c.email?.ok) ok('e-mail configurado', `modo ${c.email.modo}`);
else nok('e-mail configurado', `${c.email?.erro ?? 'não configurado'} — recuperação de senha e convites não chegarão`);

if (c.backup?.ok) ok('backup em dia', `${c.backup.quantidade} arquivo(s), último há ${c.backup.ultimoHaHoras}h`);
else if (c.backup?.configurado === false) nok('backup configurado', 'JORNADA_BACKUP_DIR não definida');
else nok('backup em dia', `último há ${c.backup?.ultimoHaHoras}h — verifique o agendamento`);

/* ---------------------------------------------------------------- resultado */

console.log(`\n${'─'.repeat(60)}`);
console.log(`${passou} passou · ${falhou} falhou · ${avisos.length} aviso(s)`);
console.log(`\nContas de teste criadas (pode remover ou ignorar):`);
console.log(`  ${CONTA_A.email}`);
console.log(`  ${CONTA_B.email}`);

if (falhou > 0) {
  console.log(`\n✗ O deploy NÃO está pronto para clientes. Corrija os itens acima.\n`);
  process.exit(1);
}

console.log(`\n✓ Deploy verificado: HTTPS, sessão, persistência, isolamento, permissões e operação.\n`);
