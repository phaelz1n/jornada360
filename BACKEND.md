# Backend do Jornada360

> **Fase 4:** a interface passou a consumir esta API de verdade. A sessão migrou para cookie `HttpOnly` (ver [AUTH.md](AUTH.md)), foram acrescentadas rotas de membros, convites, integrações, importação em lote e limpeza de histórico, além de concorrência otimista e limite de tentativas. Ver [FRONTEND_BACKEND.md](FRONTEND_BACKEND.md) e [SECURITY.md](SECURITY.md).

API REST em Node + Express com SQLite. Criada na Fase 3 sobre a arquitetura em camadas que já existia — o frontend não foi reescrito.

---

## Como executar

```bash
npm install
```

```bash
cp .env.example .env
```

```bash
npm run server
```

Sobe em `http://localhost:3333`. As migrations rodam sozinhas no boot (idempotentes). Para criar o ambiente de demonstração no banco:

```bash
npm run server:seed
```

Testes do backend:

```bash
npm run test:server
```

---

## Escolhas técnicas e por quê

| Decisão | Motivo |
|---|---|
| **SQLite via `node:sqlite`** | Embutido no Node 22+: zero dependência externa, zero compilação nativa (que costuma falhar no Windows). O SQL é padrão o bastante para uma migração futura a Postgres aproveitar quase inteiro. Para o volume de um sistema de jornada por empresa, é adequado de sobra |
| **scrypt (`node:crypto`)** em vez de bcrypt/argon2 | Função de derivação de chave projetada para senhas, embutida no Node, sem dependência nativa |
| **Token opaco + hash no banco** em vez de JWT | JWT não é revogável sem lista negra — o que reintroduz o banco que ele deveria evitar. Token opaco permite `sair` funcionar de verdade |
| **Express** | Stack conhecida, roteamento e middleware maduros. Duas dependências no total (`express`, `cors`) |
| **Snapshot do motor como JSON opaco** | O backend não interpreta nem recalcula. É o que permite o motor HE continuar intocado |

---

## Estrutura

```
server/
├── index.js              sobe a porta (só isso)
├── app.js                monta o Express — testes usam este, sem abrir socket
├── seed.js               ambiente de demonstração (comando explícito, nunca no boot)
├── db/
│   ├── index.js          conexão, migrations, transações
│   └── schema.sql        o esquema (toda tabela com tenant_id)
├── lib/
│   ├── seguranca.js      scrypt, tokens, ids
│   └── permissoes.js     matriz RBAC
├── middlewares/index.js  autenticar → resolverTenant → exigirPermissao
├── repositories/         acesso a dados, sempre filtrado por tenant
├── routes/               handlers finos: validam, chamam, respondem
└── services/             auditoria server-side
```

**Camadas:** `routes` → `services`/`repositories` → `db`. Nenhuma regra de negócio mora em rota.

---

## Onde cada regra vive

| Regra | Onde | Por quê |
|---|---|---|
| Tolerância, HE, status, prioridade, SLA, score, indicadores | **Frontend** (`src/services/`) | São cálculos sobre dados já carregados; rodam sem servidor e continuam testados por 152 testes |
| Cruzamento ponto × escala × rastreio × padrão | **Motor HE** (`public/motor-he/`) | Intocado. Roda no navegador, no iframe |
| Isolamento entre empresas | **Backend** | Nunca pode depender do cliente |
| Autenticação e autorização | **Backend** | Idem |
| Autoria da auditoria | **Backend** | Vem da sessão, não de um campo que o cliente preenche |
| Defaults neutros de empresa nova | **Duplicado** (`domain/Rules.ts` e `tenantRepository.js`) | Backend não importa do bundle do frontend. Anotado nos dois lados e coberto por teste que compara os valores |

---

## Segurança — o que está implementado

**Isolamento por tenant.** Toda consulta de dado empresarial filtra por `tenant_id`. O tenant vem da URL, mas o acesso é validado contra as *memberships* do usuário autenticado — nunca se confia no id que o cliente mandou.

**Proteção contra IDOR.** Pedir `/api/tenants/<id-de-outro-cliente>/...` devolve **404**, não 403. 403 confirmaria que aquele tenant existe, permitindo enumerar clientes. Até o `DELETE` de um recurso individual filtra por tenant, então conhecer o id de um setor alheio não permite apagá-lo.

**Senhas.** scrypt com salt por senha, comparação em tempo constante. Nunca em texto puro, nunca devolvidas em resposta.

**Sessões.** Token de 32 bytes aleatórios; o banco guarda só o hash SHA-256. Expira em 12h e é apagada na primeira tentativa de uso após vencer.

**Enumeração de contas.** "E-mail não existe" e "senha errada" devolvem a mesma mensagem e o mesmo status.

**Erros.** Nunca devolvem stack trace. O erro completo vai para o log do servidor; o cliente recebe mensagem em português.

**CORS.** Lista de origens explícita via `JORNADA_CORS_ORIGENS`. Nunca `*`.

**Corpo da requisição.** Limitado a 5 MB.

### Limitações de segurança que permanecem

| Limitação | Situação |
|---|---|
| Token em `localStorage` | Vulnerável a XSS. Cookie `httpOnly` exige API e frontend no mesmo domínio, o que ainda não é o caso |
| Sem rate limiting | Força bruta em `/entrar` não é limitada. Exige middleware dedicado ou proxy reverso |
| Sem HTTPS | Responsabilidade do deploy, não do código |
| Sem recuperação de senha | Exige serviço de e-mail. Não foi simulada |
| Sem verificação de e-mail | Qualquer e-mail sintaticamente válido cria conta |
| Sem convite de usuário | `adicionarMembro` existe no repositório, mas não há rota de convite |
| Sem rotação/expiração de sessão por inatividade | Só expiração absoluta de 12h |
| SQLite sem criptografia em repouso | O arquivo do banco é legível por quem tem acesso ao disco |

---

## API

Todas as rotas de dados exigem `Authorization: Bearer <token>`.

### Autenticação

| Método | Rota | O que faz |
|---|---|---|
| POST | `/api/auth/registrar` | Cria conta + empresa + vínculo de administrador |
| POST | `/api/auth/entrar` | Autentica e devolve token |
| POST | `/api/auth/sair` | Invalida a sessão |
| GET | `/api/auth/eu` | Usuário, empresas e permissões em cada uma |
| POST | `/api/auth/tenants` | Cria mais uma empresa |

### Dados da empresa — `/api/tenants/:tenantId`

| Método | Rota | Permissão |
|---|---|---|
| GET | `/` | `config:ler` |
| DELETE | `/` | `tenant:excluir` |
| PUT | `/empresa` | `config:escrever` |
| GET/POST/DELETE | `/unidades`, `/setores`, `/escalas`, `/colaboradores` | `config:ler` / `config:escrever` |
| GET/PUT | `/regras` | `config:ler` / `config:escrever` |
| GET | `/dias`, `/dias/:dateKey` | `dados:ler` |
| PUT | `/dias/:dateKey` | `dados:escrever` |
| PATCH | `/dias/:dateKey/casos/:chave` | `pendencia:tratar` |
| GET/PUT | `/pendencias` | `pendencia:ler` / `pendencia:tratar` |
| POST | `/pendencias/:id/revisao` | `pendencia:revisar` |
| GET | `/auditoria` | `auditoria:ler` |

---

## RBAC

| Permissão | Admin | RH/DP | Gestor | Auditor | Colaborador |
|---|:-:|:-:|:-:|:-:|:-:|
| `config:ler` | ✓ | ✓ | ✓ | ✓ | |
| `config:escrever` | ✓ | ✓ | | | |
| `usuarios:gerir` | ✓ | | | | |
| `dados:ler` | ✓ | ✓ | ✓ | ✓ | |
| `dados:escrever` | ✓ | ✓ | | | |
| `pendencia:ler` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `pendencia:tratar` | ✓ | ✓ | ✓ | | |
| `pendencia:revisar` | ✓ | ✓ | | | |
| `auditoria:ler` | ✓ | ✓ | | ✓ | |
| `relatorio:exportar` | ✓ | ✓ | ✓ | ✓ | |
| `tenant:excluir` | ✓ | | | | |

**Decisões que valem explicação:**

- **Auditor lê tudo e não escreve nada.** É o papel de quem confere; dar-lhe escrita descaracterizaria a função.
- **Gestor trata mas não revisa.** Quem executa não deveria aprovar o próprio trabalho.
- **Só administrador exclui a empresa.**

A mesma pessoa pode ter papéis diferentes em empresas diferentes — o papel está na *membership*, não no usuário.

---

## Modelo de dados

```
users ──┐
        ├── memberships ── tenants ──┬── companies
sessions┘                            ├── units ── departments
                                     ├── schedules
                                     ├── employees
                                     ├── workspace_rules
                                     ├── integration_configs
                                     ├── time_records    (snapshot do motor, JSON opaco)
                                     ├── pendings
                                     └── audit_log
```

`ON DELETE CASCADE` a partir de `tenants`: excluir a empresa apaga tudo que pertence a ela, numa operação.

## Migrations

`server/db/index.js` mantém `schema_migrations` com a versão aplicada. Rodam no boot, são idempotentes, e nunca recriam o que já existe. Para adicionar uma migração: crie o `.sql`, acrescente `{ versao, arquivo }` ao array `migracoes`.

**Ainda não há mecanismo de rollback** — para uma operação real, é o próximo passo neste arquivo.
