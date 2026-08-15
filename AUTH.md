# Autenticação e sessão

Como uma pessoa entra no Jornada360, como a sessão viaja, e o que ainda não existe.

---

## O caminho de quem chega

```
Visitante
   ↓
Portão de entrada (/bem-vindo)
   ├── Criar minha empresa  → cria conta + empresa numa operação só
   │                          (NÃO aparece com o cadastro fechado — ver abaixo)
   ├── Ver demonstração     → ambiente local, sem conta, sem servidor
   ├── Já tenho acesso      → login
   └── /convite             → cria a conta a partir de um convite recebido
   ↓
Sessão válida
   ↓
Empresas às quais a CONTA tem acesso (vindas do servidor)
   ├── uma só  → entra direto
   └── várias  → seletor
   ↓
Sistema
```

A lista de empresas **vem do servidor**, montada a partir das memberships da sessão. O frontend nunca a monta sozinho — se montasse, bastaria adivinhar um identificador para tentar entrar.

### Cadastro fechado (programa piloto)

Em produção o cadastro nasce fechado. `POST /api/auth/registrar` e `POST /api/auth/tenants` respondem **403 `cadastro_fechado`**, e o portão consulta `GET /api/auth/modo` para não oferecer um caminho que vai ser negado depois do formulário preenchido. Quem decide continua sendo o servidor — a interface só evita a frustração. Ver [PILOTO.md](PILOTO.md).

---

## Onde a sessão vive: cookie `HttpOnly`

Até a Fase 3 o token ficava em `localStorage`. Isso significa que qualquer script capaz de executar na página — uma dependência comprometida, um XSS — conseguia **ler a sessão e usá-la de outra máquina**.

Agora a sessão é um cookie `HttpOnly`, que o JavaScript da página não enxerga. O mesmo XSS ainda poderia fazer requisições enquanto a aba estiver aberta, mas não consegue **levar a sessão embora**. É uma diferença real, não cosmética.

| Atributo | Valor | Por quê |
|---|---|---|
| `HttpOnly` | sempre | JavaScript não lê — é o ponto todo |
| `SameSite` | `Lax` | O navegador não anexa o cookie em requisições disparadas por outro site |
| `Secure` | produção | Impossível em `http://localhost`; ligado por `JORNADA_COOKIE_SEGURO=1` ou `NODE_ENV=production` |
| `Path` | `/` | Toda a aplicação |
| `Max-Age` | 12 h | Cobre um turno sem reautenticar; curto o bastante para uma máquina esquecida aberta |

### O que o cookie exige em troca: mesma origem

Cookie de sessão entre origens diferentes precisaria de `SameSite=None; Secure`, o que exige HTTPS — e sem HTTPS o navegador simplesmente descarta o cookie, fazendo o login "não funcionar" em desenvolvimento.

Por isso o Vite passou a fazer **proxy de `/api`** (ver `vite.config.ts`): o navegador enxerga tudo em `localhost:5173`, o cookie é first-party e `SameSite=Lax` basta. Em produção a mesma topologia se repete — um domínio servindo frontend e API. O comportamento é idêntico nos dois ambientes, que é o que se quer de uma configuração de desenvolvimento.

### O token ainda existe, mas não para o navegador

O corpo da resposta de login só traz o token quando o cliente se identifica como cliente de API (`x-jornada-cliente: api`) — o caso dos testes, do `curl` e de uma integração servidor-a-servidor. Um navegador recebe **apenas o cookie**. Se o token não chega ao JavaScript, nenhum script consegue copiá-lo.

---

## CSRF

Cookie é anexado automaticamente pelo navegador — é justamente isso que abre espaço para falsificação de requisição.

A proteção é exigir um cabeçalho próprio (`x-jornada-cliente: web`) em toda requisição que **altera estado** e que se autenticou por cookie. Um formulário ou `<img>` de outro site não consegue definir cabeçalho customizado sem passar por preflight de CORS, que a lista de origens recusa.

- **Leitura por cookie**: não exige o cabeçalho (não altera nada).
- **Escrita por cookie**: exige. Sem ele, `403 origem_nao_confiavel`.
- **Qualquer método por Bearer**: não exige — um token que o cliente anexa à mão não viaja sozinho, então o vetor não existe.

Coberto por `server/seguranca.test.js`.

---

## Recuperação de senha

Existe e funciona ponta a ponta desde a Fase 5.

```
Esqueci minha senha → e-mail com link → nova senha → entrar
```

| Regra | Por quê |
|---|---|
| **Validade de 30 minutos** | É uma janela em que quem tiver acesso ao e-mail entra na conta. Precisa ser estreita |
| **Uso único** | Um link parado numa caixa de e-mail antiga continuaria abrindo a conta |
| **Um pedido invalida os anteriores** | Quem pede duas vezes usa o mais novo; os antigos morrem na hora |
| **Só o hash do token no banco** | Vazar o banco não pode entregar credencial utilizável |
| **Trocar a senha encerra TODAS as sessões** | Se a pessoa está recuperando porque alguém entrou na conta dela, manter as sessões abertas anularia o esforço |
| **Não abre sessão automaticamente** | Entrar com a senha nova confirma, ali mesmo, que ela funciona |
| **Resposta idêntica para conta inexistente** | Senão a rota vira um verificador de quem tem conta no sistema |
| **Limite de 5 pedidos por hora, por IP** | — |

O link é validado **ao abrir a tela**, antes de qualquer campo aparecer: deixar a pessoa escolher e confirmar uma senha para só então dizer "expirou" é gastar o tempo dela num caminho já inválido.

**Sem SMTP configurado, o servidor recusa subir em produção** — em vez de a tela prometer um envio que não acontece.

---

## Senha

- **scrypt** (`node:crypto`, N=16384, r=8, p=1), salt por usuário, comparação em tempo constante.
- Formato guardado: `scrypt$N$r$p$salt$hash`. **Nunca** senha em texto puro.
- Mínimo de 8 caracteres, validado no servidor (a validação da tela é só resposta imediata).
- A senha **nunca volta em resposta nenhuma** — verificado por teste.
- O frontend não guarda a senha em estado que sobreviva ao envio.

### Login que falha

A mensagem é a mesma para e-mail inexistente e senha errada: **"E-mail ou senha incorretos."** Distinguir os dois casos permitiria descobrir quais e-mails têm conta no sistema.

### Limite de tentativas

| Rota | Limite | Janela |
|---|---|---|
| `POST /api/auth/entrar` | 10 | 15 min |
| `POST /api/auth/registrar` | 5 | 60 min |

Por IP + rota, janela deslizante, em memória. Quando bloqueia, responde `429` com `Retry-After` — e **a senha correta também é barrada** enquanto o bloqueio vale; se ela passasse, o limite não atrapalharia quem estivesse adivinhando.

**Limitação honesta:** protege um processo. Com várias instâncias atrás de um balanceador, cada uma tem o próprio contador e o limite efetivo se multiplica. Trocar por Redis é o passo para esse cenário — está em [SECURITY.md](SECURITY.md).

---

## Papéis

O papel não é rótulo organizacional: é o que o servidor consulta para autorizar ou recusar **cada requisição**.

| Papel | O que pode |
|---|---|
| `administrador` | Tudo, inclusive gerir acessos e excluir a empresa |
| `rh` | Configurar, tratar e revisar pendências, ler auditoria, exportar |
| `gestor` | Ler cadastro, tratar pendências, exportar — **não revisa** (quem executa não aprova o próprio trabalho) |
| `auditor` | Lê tudo e exporta, **nunca escreve** |
| `colaborador` | Só as próprias pendências |

A interface usa a mesma matriz para esconder o que não faz sentido oferecer. **Isso é conveniência, não controle de acesso** — o servidor verifica de novo em cada rota. Esconder botão nunca foi segurança.

> `visualizador` foi renomeado para `colaborador` para casar com o backend. Cadastros antigos são convertidos na leitura por `normalizarPapel` — ninguém perde vínculo por causa de um nome que mudou.

---

## Dar acesso a outra pessoa

Duas situações diferentes, tratadas como tais:

**A pessoa já tem conta** → vincular pelo e-mail (`POST /membros`). O papel é escolhido na hora.

**A pessoa ainda não tem conta** → convite. Criar a conta por ela significaria definir a senha dela.

### Convites

- O código aparece **uma vez**, no momento da criação. O banco guarda só o hash — mesma razão da senha e do token.
- É **nominal**: só funciona para o e-mail em que foi emitido. Sem isso, um convite poderia ser repassado a quem o administrador não escolheu.
- É de **uso único** e expira em 7 dias.

**O envio por e-mail funciona** (Fase 5). O código continua aparecendo na tela mesmo assim, de propósito: se o e-mail cair no spam ou o endereço estiver errado, o administrador ainda entrega o acesso por outro canal. Um sistema que depende exclusivamente do e-mail chegar deixa alguém trancado do lado de fora quando ele não chega.

A resposta traz `emailEnviado`, e a interface diz a verdade sobre o que aconteceu — "enviamos" ou "não conseguimos enviar, entregue o código".

### Aceitar um convite sem ter conta

`POST /api/auth/convites/aceitar` (tela `/convite`) cria a conta **a partir do convite**, para quem ainda não tem nenhuma. Existe porque, com o cadastro fechado, a única porta era `/registrar` — que cria conta E empresa —, então um colega convidado por um cliente do piloto não conseguia sequer existir no sistema.

Isto **não reabre o cadastro**: o convite é a credencial. O e-mail da conta criada é o do convite, não o que o visitante digitar — aceitar com outro endereço é exatamente o que o convite nominal impede. Quem já tem conta recebe `409 email_em_uso` com a orientação de entrar e resgatar de dentro; criar uma segunda conta com o mesmo e-mail partiria o histórico da pessoa em dois usuários.

### Proteção do último administrador

Remover ou rebaixar o último administrador deixaria a empresa sem ninguém capaz de gerir acesso, e desfazer isso exigiria mexer no banco à mão. O servidor recusa com `400 ultimo_administrador`.

---

## O que ainda NÃO existe

| Recurso | Situação |
|---|---|
| **Verificação de e-mail** | Não implementada. Nada impede criar conta com o e-mail de outra pessoa |
| **Autenticação em dois fatores** | Não implementada |
| **Login social (Google, Microsoft)** | Não implementado, e fora de escopo por decisão |
| **Expiração por inatividade** | Não implementada. A sessão vale 12 h fixas a partir da criação |
| **Revogar todas as sessões de um usuário** | Não implementado. Sair encerra apenas a sessão atual |

Nada disso foi simulado. Um fluxo que finge funcionar é pior do que a ausência dele — especialmente em autenticação.

---

## Onde está cada coisa

| Arquivo | Papel |
|---|---|
| `server/lib/sessaoHttp.js` | Cookie, CSRF, leitura do token |
| `server/lib/seguranca.js` | scrypt, hash de token, geração de id |
| `server/lib/limiteDeTaxa.js` | Janela deslizante por IP |
| `server/repositories/userRepository.js` | Contas e sessões |
| `server/repositories/conviteRepository.js` | Convites |
| `server/middlewares/index.js` | `autenticar` → `resolverTenant` → `exigirPermissao` |
| `src/auth/AuthContext.tsx` | Estado de sessão no frontend (três estados) |
| `src/api/authService.ts` | Conduz o fluxo; não guarda token nem senha |
| `src/pages/Entrar.tsx` · `CriarConta.tsx` · `NovaEmpresa.tsx` | Telas |
