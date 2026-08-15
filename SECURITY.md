# Segurança

O que está protegido, como, e o que ainda não está. Escrito para ser conferido, não para tranquilizar.

---

## A configuração insegura impede o servidor de subir

Acrescentado na Fase 5, e é a defesa mais valiosa deste documento.

A forma mais comum de um sistema ir para produção inseguro não é alguém decidir isso: é um valor de desenvolvimento sobrando numa variável que ninguém conferiu. CORS apontando para localhost, cookie sem `Secure`, banco dentro da pasta do código que o próximo deploy apaga. Nada disso quebra nada — o sistema sobe, funciona, e está errado.

Por isso o servidor **recusa subir** em produção e lista o que está errado. Um aviso no log seria fácil demais de ignorar. Ver `server/config.js` e os 12 casos cobertos em `server/producao.test.js`.

---

## Princípios

**1. O servidor é a autoridade.** A interface pode esconder o que não faz sentido oferecer, mas quem decide é o backend, que verifica de novo em cada requisição. Esconder botão nunca foi segurança.

**2. O cliente não escolhe em quem opera.** O `tenantId` vem da URL, mas só é aceito depois que o servidor confirma que o usuário da sessão tem vínculo com ele. Nunca "o frontend pediu o tenant X, então entregue o tenant X".

**3. Recusar sem revelar.** Acesso a uma empresa alheia devolve **404, não 403**. Um 403 confirmaria que aquela empresa existe — informação suficiente para enumerar clientes.

**4. Não fingir.** Nenhum mecanismo aparenta funcionar sem funcionar. Sem SMTP configurado, o servidor recusa subir em produção — em vez de a tela prometer um e-mail que nunca sai.

---

## Isolamento entre empresas

```
autenticar  →  resolverTenant  →  exigirPermissao  →  rota
   sessão        membership          papel × ação
```

A **ordem é a segurança**. Nenhuma rota de dados é alcançável sem passar pelos três.

Toda tabela de negócio tem `tenant_id`, e toda consulta filtra por ele. Uma tabela nova sem `tenant_id` é um vazamento esperando para acontecer.

**Verificado por 25 testes de isolamento** (`server/isolamento.test.js`) e mais 8 no fluxo completo, exercitando as rotas reais por HTTP:

| Cenário | Esperado |
|---|:-:|
| A lê A / B lê B | 200 |
| A lê B / B lê A | **404** |
| A escreve em B | **404** (e nada é gravado) |
| A exclui a empresa de B | **404** |
| Sem sessão / token inválido | 401 |

O corpo do 404 não menciona nada da empresa alheia.

---

## Sessão

| Item | Como está |
|---|---|
| Transporte | Cookie `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` em produção |
| Legível por JavaScript | **Não** — é o ponto do `HttpOnly` |
| Guardado no banco | Apenas o **hash SHA-256** do token |
| Validade | 12 h a partir da criação |
| Expirada | Apagada do banco na primeira tentativa de uso |
| Sair | Encerra no servidor **e** apaga o cookie |

O token só volta no corpo para quem se declara cliente de API (`x-jornada-cliente: api`). Um navegador recebe só o cookie — se o token não chega ao JavaScript, nenhum script consegue copiá-lo.

Detalhes em [AUTH.md](AUTH.md).

---

## CSRF

Escrita autenticada **por cookie** exige o cabeçalho `x-jornada-cliente: web`. Um site malicioso não consegue defini-lo sem preflight de CORS, que a lista de origens recusa. Leitura não exige (não altera estado). Bearer não exige (não viaja sozinho).

---

## Senha

scrypt (N=16384, r=8, p=1), salt por usuário, `timingSafeEqual`. Nunca em texto puro, nunca em resposta, nunca em log. Mínimo de 8 caracteres, validado no servidor.

Login que falha devolve a mesma mensagem para e-mail inexistente e senha errada.

---

## Limite de tentativas

| Rota | Limite | Janela |
|---|---|---|
| `/api/auth/entrar` | 10 | 15 min |
| `/api/auth/registrar` | 5 | 60 min |

Por IP + rota. Quando bloqueia, `429` com `Retry-After` — e a senha correta também é barrada, senão o limite não atrapalharia quem estivesse adivinhando.

**Escopo honesto:** protege **um processo**, em memória. Com várias instâncias o limite efetivo se multiplica. Também não impede um atacante distribuído, e não substitui senha forte.

---

## RBAC

11 permissões × 5 papéis, aplicadas na rota. `auditor` lê e exporta mas nunca escreve; `gestor` trata mas não revisa; só `administrador` gere acessos e exclui a empresa.

A interface usa a **mesma** matriz (vinda do servidor em `/api/auth/eu`) para esconder o que seria negado. Não existe uma segunda matriz no frontend — uma cópia divergente seria pior que nenhuma.

Revisão de pendência tem **rota própria**, com permissão separada de tratamento, e o autor vem da sessão. Enviar `revisadoPor` no corpo é ignorado — verificado por teste.

---

## Auditoria

Gravada pelo **servidor**, dentro da rota que alterou o dado, com autor e timestamp resolvidos ali. O cliente não escreve na trilha e não escolhe o autor.

A única exceção é a exportação de relatório — o servidor não tem como saber que um CSV foi gerado no navegador. Mesmo assim o autor continua vindo da sessão; o cliente só descreve o que exportou.

---

## Acesso comercial (programa piloto)

Durante o programa piloto, **quem pode existir no sistema é uma decisão do operador, não do visitante**:

- Em produção o cadastro nasce fechado (`JORNADA_CADASTRO_ABERTO`). `POST /api/auth/registrar` e `POST /api/auth/tenants` respondem **403 `cadastro_fechado`**. O segundo é o que muita gente esquece: sem ele, bastaria entrar por convite e abrir quantas empresas quisesse.
- A recusa acontece **no servidor**. `GET /api/auth/modo` existe só para a interface não oferecer um caminho que vai ser negado — esconder o botão nunca foi a proteção.
- `POST /api/auth/convites/aceitar` cria conta a partir de um convite **nominal, de uso único e com validade de 7 dias**. O e-mail da conta vem do convite, nunca do que a pessoa digita: é isso que impede repassar um convite a outra pessoa.
- **Suspensão** de uma empresa encerra as sessões abertas de todos os membros e passa a recusar leitura e escrita com **403 `empresa_suspensa`**. Sem o encerramento das sessões, quem já estava dentro continuaria trabalhando até o token expirar.
- O 403 aqui é deliberado, e não o 404 usado para IDOR: quem recebe tem vínculo legítimo com a empresa. Esconder a existência dela seria mentir para o próprio dono do dado.
- **Nenhum dado é apagado por suspensão**, e não existe rota HTTP que atravesse empresas — nem para feedback. A visão cruzada do operador existe apenas na CLI, que roda no servidor.

---

## Respostas

- **Nunca stack trace nem caminho interno** ao cliente. O erro completo vai para o log do servidor, onde é útil.
- Cabeçalhos: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`.
- CORS por lista de origens, com `credentials: true`. **Nunca `*`** — e com credenciais, uma origem errada na lista significa entregar o cookie ao site errado.
- Corpo limitado a 5 MB.

---

## Segredos

- Nenhuma credencial no repositório. `.env` no `.gitignore`; só `.env.example` é versionado.
- Toda variável `VITE_` **entra no bundle e é pública** — nenhum segredo pode usar esse prefixo. Documentado em `.env.example`.
- Credencial de integração (Cobli, sistema de ponto) mora no **servidor**, e nunca chega ao navegador. A tela de Integrações só registra "esta empresa usa esta fonte".
- Varredura do repositório: só fixtures de teste e a senha do seed de demonstração — comentada no código como pública de propósito, num ambiente sem dado real.

---

## Portfólio e apresentação

Públicos por decisão de produto. **Não importam repositório nenhum** — não é convenção, é estrutural: não existe caminho pelo qual dado de empresa, auditoria, colaborador ou tenant chegue até lá.

---

## Dados pessoais

O sistema guarda nome, e-mail e cargo de colaboradores, além de registros de jornada. Não guarda CPF, endereço, dado bancário nem dado de saúde.

**O que ainda não existe para LGPD:** exportação dos dados de um titular, exclusão a pedido, política de retenção, registro de consentimento. A exclusão da empresa apaga tudo em cascata, o que cobre o caso mais amplo, mas não o pedido individual.

---

## Limitações que permanecem

| Limitação | Impacto | Caminho |
|---|---|---|
| ~~Sem HTTPS~~ | **Resolvido (Fase 5)** — Caddy + Let's Encrypt, automático | — |
| **Limite de tentativas por processo** | Multiplica com várias instâncias | Redis |
| ~~Sem recuperação de senha~~ | **Resolvido (Fase 5)** — link por e-mail, 30 min, uso único | — |
| **Sem verificação de e-mail** | Conta com e-mail de outra pessoa | Mesma dependência |
| **Sem 2FA** | Senha é o único fator | — |
| **Sem expiração por inatividade** | Sessão vale 12 h mesmo parada | — |
| **Sem revogar todas as sessões** | Sair encerra só a atual | — |
| **SQLite sem criptografia em repouso** | Acesso ao disco = acesso ao dado | Criptografia de volume, ou Postgres |
| **Isolamento garantido pela aplicação** | Uma consulta sem `WHERE tenant_id` vazaria | Row Level Security no Postgres |
| **Sem alerta configurado** | O sistema expõe `/api/prontidao`; falta apontar um monitor externo | 10 minutos de configuração — ver OPERACAO.md |
| ~~Sem rotação de log~~ | **Resolvido (Fase 5)** — limite no docker-compose | — |
| **Backup só no mesmo servidor** | Se a máquina se perder, o backup se perde junto | Cópia externa — ver DEPLOY.md |

---

## Cobertura de teste da segurança

| Arquivo | O que prova |
|---|---|
| `server/isolamento.test.js` | 25 testes de acesso cruzado entre dois tenants |
| `server/rbac.test.js` | 14 testes da matriz de permissões nas rotas |
| `server/seguranca.test.js` | 14 testes de cookie, CSRF, limite de tentativas, cabeçalhos, vazamento em resposta |
| `server/fluxoCompleto.test.js` | 35 testes ponta a ponta, incluindo isolamento, concorrência e falsificação de autor |
| `src/App.test.tsx` | 22 testes de interface, incluindo guarda de rota, sessão expirada, ausência de token no armazenamento e o que o portão mostra com o cadastro fechado |
| `server/producao.test.js` | 30 testes da guarda de configuração, do backup verificável, da restauração e da recuperação de senha |
| `server/piloto.test.js` | 10 testes de cadastro fechado, suspensão preservando os dados, reativação e isolamento do feedback |
| `scripts/smoke.js` | 31 verificações contra a URL publicada — HTTPS, cookie, persistência, isolamento, permissões |

---

## Reportar um problema

Não há canal público (o projeto não está publicado). Se encontrar algo, registre no repositório com o que foi observado, como reproduzir e o impacto.
