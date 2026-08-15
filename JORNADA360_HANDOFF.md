# Jornada360 — Handoff técnico

Documento de continuidade. Se você é um desenvolvedor abrindo este projeto pela primeira vez (ou uma sessão nova sem contexto), **leia este arquivo inteiro antes de tocar em qualquer código**. Ele responde o que o sistema é, como está organizado, quais decisões foram tomadas e por quê, o que está pronto, o que não está, e como continuar.

Atualizado em 2026-08-15, ao final do **MVP Comercial / Programa Piloto**.

> **Classificação do produto: Jornada360 — MVP Comercial / Programa Piloto.** A primeira versão
> comercial é uma **venda piloto**: poucas empresas, liberadas uma a uma, com cobrança e suporte
> manuais. O sistema não faz autoatendimento por decisão, não por falta. Quem opera o piloto lê
> [PILOTO.md](PILOTO.md). **O desenvolvimento estrutural está interrompido** — o próximo passo é
> colocar clientes usando, e é o que eles disserem que define a fase seguinte.

---

## 1. O que é o sistema

O Jornada360 é uma plataforma de **gestão e auditoria de jornada de trabalho**. Ela cruza quatro fontes de dados de um dia — espelho de ponto, escala, rastreamento veicular e horário padrão cadastrado — identifica jornadas fora do esperado, transforma cada uma numa unidade de trabalho rastreável, e conduz essa unidade até a resolução auditada.

**Quem usa:** analistas de RH/DP e gestores operacionais que hoje fariam essa conferência comparando planilhas linha por linha.

**O que entrega:** em vez de "aqui estão 200 registros, procure os problemas", entrega "aqui estão os 12 casos que exigem sua decisão, ordenados por prioridade, cada um com o motivo explicado, um responsável, um prazo e um histórico do que já foi feito".

O ciclo completo:

```
DADOS → ANÁLISE → PENDÊNCIA → PRIORIZAÇÃO → EXPLICAÇÃO
      → RESPONSÁVEL → PRAZO → SLA → RESOLUÇÃO
      → APROVAÇÃO/REPROVAÇÃO → AUDITORIA → INDICADORES → RELATÓRIO
```

Tudo isso funciona **por empresa**, e configurar uma empresa nova não exige tocar em código.

---

## 2. Como executar

```bash
cd jornada360
npm install
npm run dev
```

Abre em `http://localhost:5173`, no **portão de entrada**, com três caminhos: criar conta e empresa, ver a demonstração, ou entrar. O sistema **não** cria nenhuma empresa sozinho; só o ambiente de demonstração é preparado no bootstrap. Sem a API no ar, criar conta e entrar ficam indisponíveis — e a tela diz isso — mas a demonstração continua funcionando.

```bash
npm run build
```

```bash
npx tsc -b
```

### Desenvolvimento — a pilha completa, com um comando

```bash
npm run dev:all
```

Sobe a API (`localhost:3333`) e o frontend (`localhost:5173`). **Abra apenas `localhost:5173`** — o Vite faz proxy de `/api`, e é isso que torna o cookie de sessão first-party. Sem o proxy, o cookie exigiria HTTPS e o login não funcionaria localmente.

O banco (`data/jornada360.db`) é criado e migrado sozinho. Nenhum passo manual.

### Testes

```bash
npm run test:all
```

**275 testes:** 153 de regra de negócio + 19 de interface (jsdom) + 103 de backend (node). `npm run test:coverage` mede cobertura dos services.

### O que exige servidor e o que não exige

| | Precisa da API? |
|---|---|
| **Demonstração** | **Não.** Local, fictícia, abre com o servidor desligado |
| **Empresa real** | **Sim.** Os dados dela ficam no servidor |
| Portfólio e apresentação | Não |

Nenhuma credencial fica no repositório. `.env.example` lista as variáveis; `.env` está ignorado.

---

## 3. Arquitetura

```
Tela
 │  lê SÍNCRONO do contexto  ·  grava chamando `gravar(...)`
 ▼
Serviços / Domínio (src/services/*)     ← regras PURAS, sem UI e sem I/O
 ▼
ConjuntoRepositorios (src/data/tipos.ts) ← contrato único
 ├── conjuntoLocal  → localStorage        (demonstração)
 └── conjuntoRemoto → src/api/client.ts   (empresa real)
                          ▼
                  API REST → routes → services/repositories → SQLite (tenant_id em toda tabela)
```

**A peça que faz isso funcionar:** o carregamento é assíncrono e acontece **uma vez**, no `WorkspaceProvider`. A leitura continua **síncrona** para quem está dentro do sistema — é por isso que as treze telas sobreviveram à migração sem serem reescritas. O roteador só monta o shell depois que o dado chegou.

**A escolha entre local e remoto acontece uma vez.** Nenhuma tela pergunta "estou no demo?" — se você se pegar escrevendo esse `if`, pare: a fábrica existe exatamente para isso.

**Regra que sustenta tudo:** a interface nunca fala com `localStorage` diretamente. Quando existir backend, só a implementação de cada repositório muda (`localStorage` → `fetch`); o contrato TypeScript e tudo acima dele — services, hooks, telas — não muda.

Três regras derivadas, igualmente importantes:

- **Regra de negócio não mora em componente React.** Se você está escrevendo um `if` que decide algo sobre o domínio dentro de um `.tsx`, provavelmente ele pertence a um service.
- **Service não faz I/O.** Ele calcula e devolve; quem grava é a camada de dados. Uma regra que escreve sozinha só funciona onde conhece o armazenamento — e deixa de valer nos dois caminhos.
- **Não existe segunda fonte de verdade.** Se dois lugares precisam da mesma informação, os dois chamam a mesma função. Quando você encontrar uma tela reimplementando algo que um service já faz, isso é bug, não estilo.

---

## 3b. Entrada no sistema — o que muda em relação a versões anteriores

**Regra de produto crítica:** ninguém entra numa empresa sem escolher.

```
App
 ├── AuthProvider          quem é a pessoa (verificando / autenticado / anônimo)
 └── WorkspaceProvider     qual empresa, e TODO o dado dela
      ├── sem empresa ativa (ou ainda carregando) → RotasPublicas
      └── com dado carregado                       → RotasDaAplicacao (AppLayout + 13 telas)
```

O `AuthProvider` tem **três** estados, não dois. Além de "logado" e "não logado" existe **"ainda não sei"** — a checagem inicial contra o servidor leva alguns milissegundos, e tratar esse intervalo como "não logado" faria o portão piscar a cada recarga para quem tem sessão válida.

A **lista de empresas vem do servidor**, montada a partir das memberships da sessão. O frontend nunca a monta sozinho — se montasse, bastaria adivinhar um identificador para tentar entrar.

Por isso o contexto de empresa tem **dois hooks**:

| Hook | Empresa ativa | Quem usa |
|---|---|---|
| `useSessao()` | pode ser **null** | `App.tsx`, `AppState`, portão, aba de migração |
| `useWorkspace()` | **garantida** (lança erro se não houver) | as 13 telas operacionais |

Se `useWorkspace()` pudesse devolver null, todas as telas precisariam tratar esse caso — e uma que esquecesse quebraria em runtime. Quem chega dentro do shell já passou pelo portão E pelo carregamento, e o tipo reflete isso. **Ao criar uma tela nova:** use `useWorkspace()` se ela vive dentro do shell, `useSessao()` se é pública.

**A empresa salva localmente não é autorização.** Se a conta não tem mais acesso a ela, o provedor a descarta e volta ao portão — em vez de tentar carregar e receber 404.

Detalhes completos em [AUTH.md](AUTH.md) e [ONBOARDING.md](ONBOARDING.md).

---

## 4. Estrutura de pastas

```
src/
├── domain/          Tipos puros, sem lógica (Company, Unit, Department, Employee,
│                     Schedule, Rules, IntegrationConfig, UserAccess, WorkspaceConfig, Pendencia)
├── services/        Regras de negócio, PURAS (13 arquivos — ver seção 7)
├── data/            A camada que a Fase 4 acrescentou:
│                      tipos.ts          o contrato único de persistência
│                      conjuntoLocal.ts  implementação localStorage (demonstração)
│                      conjuntoRemoto.ts implementação API (empresa real)
│                      useRecurso.ts     useRecurso + useGravacao
├── auth/            AuthContext — quem é a pessoa e onde ela pode entrar
├── api/             client.ts (único `fetch` do frontend) + authService
├── repositories/    Implementação localStorage — hoje é a da DEMONSTRAÇÃO (13 arquivos)
├── integrations/    Contrato IntegrationAdapter + 4 adapters
├── workspace/       WorkspaceContext — dono de "qual empresa estou vendo"
├── demo/            seedDemo.ts — gerador determinístico do dataset fictício
├── engine/          Ponte para o motor real de HE (ver seção 5)
├── state/           AppState — trilha de auditoria exposta à UI
├── portfolio/       Catálogo de projetos (dados puros) — não acessa repositório nenhum
├── pages/           Uma tela por rota + settings/ (9 sub-abas de Configurações)
│                     BemVindo / Portfolio / Apresentacao = rotas públicas, fora do shell
├── components/      UI reutilizável + components/he/ + components/onboarding/
└── hooks/, utils/   Auxiliares genéricos

public/motor-he/index.html   O motor legado (ver seção 5)
```

---

## 5. O motor de HE — a parte mais delicada do projeto

`public/motor-he/index.html` é um assistente de HE diário **que já estava em produção** antes do Jornada360 existir. Ele faz o trabalho pesado: parsing de planilhas xlsx (espelho, escala, rastreio Cobli, horário padrão), correspondência difusa de nomes, e a primeira classificação de divergência. Roda dentro de um iframe (`src/pages/MotorHE.tsx`).

**Trate esse arquivo como intocável no que diz respeito à lógica de cruzamento.** Ele funciona, está validado contra dados reais, e reescrevê-lo não traria ganho — traria risco.

`src/engine/heEngineCore.ts` porta em TypeScript **apenas as funções puras de pós-processamento** (`normName`, `heEfetivo`, `reclassificar`, `resolvedSetor`). O parsing de xlsx continua exclusivamente dentro do iframe. `heEngineBridge.ts` lê/escreve o mesmo `localStorage` que o iframe usa; `TimeRecordRepository` envelopa o bridge; `useHEEngineData.ts` é o hook que a UI consome.

### As 5 alterações feitas no motor (e por que cada uma)

Todas seguem o mesmo princípio: **tirar do arquivo o que pertencia a uma empresa específica e passar a receber isso de fora, por querystring.**

| # | O quê | Por quê |
|---|---|---|
| 1 | `LS_PREFIX` inclui `?ws=` | Isolar as empresas entre si no storage |
| 2 | `SETOR_MAP` esvaziado | Continha ~26 nomes reais de motoristas hardcoded — travava o arquivo numa operação |
| 3 | `SETOR_OPTS`/`CAUSA_OPTS` de `?setores=`/`?causas=` | Mesma fonte que a tela React usa, sem lista paralela |
| 4 | `tol`/`meta`/`reinc`/`interj`/`intervalo` por querystring | Eram constantes fixas — inclusive `META_MIN = 36:50`, meta diária de uma operação real |
| 5 | Cálculo de intervalo intrajornada (novo) | Não existia; interjornada já existia mas com 11h fixo |

Sem os parâmetros (arquivo aberto direto, fora do Jornada360), cada um cai num fallback genérico e o motor continua funcionando sozinho.

**Se você precisar mexer no motor:** confira com `diff` contra o original que nenhuma lógica de cruzamento mudou, e documente a alteração aqui, em ARCHITECTURE.md e no cabeçalho do próprio arquivo.

---

## 6. Entidades

| Entidade | Onde | Papel |
|---|---|---|
| `WorkspaceConfig` | `domain/WorkspaceConfig.ts` | Uma empresa configurada. Contém company, units, departments, employees, schedules, causaOpts, rules, integrations, users |
| `Company` / `Unit` / `Department` / `Employee` / `Schedule` | `domain/` | Cadastro organizacional |
| `Rules` | `domain/Rules.ts` | Os 7 parâmetros configuráveis (ver seção 8) |
| `UserAccess` | `domain/UserAccess.ts` | Quem opera o sistema. Referenciado por `Pendencia.responsavelId` |
| `Pendencia` | `domain/Pendencia.ts` | **A entidade central.** Unidade de trabalho rastreável |
| `AuditEntry` | `repositories/AuditRepository.ts` | Registro de alteração manual |

### `Pendencia` em detalhe

Representa uma ocorrência que precisa ser acompanhada. **O motor decide "há uma divergência aqui"; a Pendencia rastreia o que fazer com isso.**

Id determinístico: `pend-{workspaceId}-{dateKey}-{chaveDoColaborador}`. A mesma combinação sempre produz o mesmo id, então sincronizar de novo nunca duplica.

Estados (`StatusPendencia`): `normal`, `atencao`, `divergencia`, `pendente`, `justificado`, `aprovado`, `reprovado`.

Fluxo de status:

```
divergencia|atencao|pendente  ──(resolver)──►  justificado
                                                   │
                                        ┌──────────┴──────────┐
                                   (aprovar)             (reprovar)
                                        │                     │
                                    aprovado              reprovado
                                                              │
                                                         (reabrir)
                                                              │
                                                              ▼
                                              volta a divergencia|atencao|pendente
```

**Armadilha importante:** `statusDoCaso()` nunca retorna `aprovado`/`reprovado` — esses só existem por decisão humana. Sem proteção, cada sincronização reclassificaria um caso revisado de volta para `justificado` (porque `item._done` continua `true`), apagando a decisão silenciosamente. É isso que `pendenciaService.statusAlvoSincronizacao` impede. **Se você mexer na sincronização, preserve esse comportamento.**

---

## 7. Services — o que cada um faz

| Service | Responsabilidade |
|---|---|
| `toleranceService` | Padrão × registro × tolerância → normal/divergência |
| `overtimeService` | HE programada × realizada × excedente |
| `journeyService` | Porta de leitura dos alertas de interjornada/intervalo detectados pelo motor |
| `recurrenceService` | Reincidência por colaborador |
| `scoreService` | Score multidimensional (5 dimensões) |
| `pendingClassificationService` | Quais casos viram pendência + derivação do status unificado |
| `pendenciaService` | **Calcula** o estado da Pendencia (não grava); responsável, prazo, ordenação, ação necessária. `sincronizarPendencias` devolve só o que mudou |
| `pendingExplanationService` | "Por que isso apareceu?" — narra, nunca recalcula |
| `priorizacaoService` | Recomendação determinística de prioridade |
| `slaService` | Estado de prazo (6 estados) |
| `analyticsService` | Todos os indicadores do Dashboard Executivo |
| `reportService` | Os 7 relatórios + exportação CSV |
| `workspaceService` | Ciclo de vida de empresa (criar/excluir em todos os namespaces) |
| `onboardingService` | Progresso de configuração — **derivado** do cadastro, nunca um flag salvo |

---

## 8. Configuração — o que é parametrizável

Tudo em Configurações → Regras, por empresa. **Nenhum é constante fixa no código, nem no motor.**

| Parâmetro | Padrão | Onde é aplicado |
|---|---|---|
| `toleranceMin` | 10 min | `toleranceService` + motor |
| `dailyGoalMin` | **0 = não configurada** | Indicadores de meta + motor |
| `recurrenceLimit` | 5 dias | `recurrenceService`, `priorizacaoService` + motor |
| `intervalMinMin` | 60 min | Motor → `journeyService` |
| `interjourneyMinHours` | 11 h | Motor → `journeyService` |
| `prazoPadraoDias` | 3 dias | `pendenciaService.sugerirPrazo` (só sugere) |
| `alertaAntecedenciaDias` | 1 dia | `slaService` |

**`dailyGoalMin` nasce em 0 de propósito:** o sistema nunca assume a meta de nenhuma empresa. Com 0, os painéis de meta mostram "—" em vez de comparar com um alvo inventado.

Workspaces salvos antes de um campo existir recebem o default **na leitura** (`WorkspaceRepository.listAll` espalha `regrasPadrao()` antes de `w.rules`), sem sobrescrever o que já foi configurado. **Use esse padrão ao adicionar um campo novo em `Rules`.**

---

## 9. Múltiplas empresas e isolamento

Uma empresa = um `WorkspaceConfig` + namespaces próprios de storage:

| Dado | Chave |
|---|---|
| Configuração de todas as empresas | `jornada360:workspaces` (uma chave, array) |
| Empresa ativa | `jornada360:activeWorkspaceId` |
| Auditoria | `jornada360:{id}:auditLog` |
| Pendências | `jornada360:{id}:pendencias` |
| Relatórios exportados | `jornada360:{id}:reports` |
| Dias processados pelo motor | `assistente_he_local_{id}_...` |

**Criar empresa** (Configurações → Empresas): nasce vazia, com defaults neutros, **sem herdar nada da anterior**. Sempre ambiente `real` — `demo` é reservado ao ambiente de demonstração, cujo seed fictício nunca pode ser disparado sobre uma empresa de verdade.

**Excluir empresa**: remove todas as chaves acima. `real` e `demo` são protegidos.

**Ao adicionar um novo tipo de dado por empresa, atualize `workspaceService.excluirWorkspace()`** — senão a exclusão deixa dado órfão.

---

## 10. Integrações

`src/integrations/IntegrationService.ts` define o contrato `IntegrationAdapter`. Quatro adapters:

| Adapter | Estado |
|---|---|
| `FileImportIntegration` | **Real** — é o que a tela Importar Dados usa |
| `CobliIntegration` | Stub — `disponivel: false` |
| `TimeClockIntegration` | Stub — `disponivel: false` |
| `ApiIntegration` | Stub — `disponivel: false` |

Os stubs existem para documentar o ponto de extensão, não para simular funcionamento. **Nenhuma credencial é digitada em lugar nenhum** — integração real exige backend (Fase 4).

---

## 11. Decisões tomadas — e o raciocínio por trás

Entender estas decisões evita "consertar" coisas que estão certas.

**Nunca inventar um número.** Quando um indicador não pode ser calculado, ele devolve `null` e a tela mostra "—" com o motivo. Isso aparece em vários lugares: taxa de aprovação sem nenhuma revisão, aderência ao prazo sem nenhuma pendência resolvida com prazo, dias acima da meta sem meta configurada, dimensão do score sem base de cálculo. **Se você se pegar preenchendo um valor default para "não ficar vazio", pare.**

**Recomendar não é decidir.** `priorizacaoService` sugere prioridade e `sugerirPrazo` sugere data — nenhuma das duas escreve nada sozinha. Aplicar é um clique explícito. Prioridade manual nunca é sobrescrita automaticamente.

**Resolver não é aprovar.** São decisões diferentes, em momentos diferentes, possivelmente de pessoas diferentes. O bloco de revisão só aparece depois que o caso está `justificado`.

**Peso igual no score é decisão, não descuido.** Qualquer outro conjunto de pesos seria um juízo de valor que o negócio ainda não tomou.

**Dado não vinculado fica visível.** Registros que não casam com o cadastro de colaboradores aparecem como "Sem vínculo com o cadastro" em vez de serem distribuídos entre as unidades reais. É a forma honesta de mostrar que o recorte só é confiável na medida do cadastro.

**Storage de config numa chave só** (`jornada360:workspaces`) em vez de uma por empresa: volume pequeno, a lista inteira já é lida para popular o seletor, e migrar agora perderia config existente sem um passo de migração. Isolamento continua garantido — cada empresa só lê/escreve o próprio objeto no array.

**Nomes duplicados de setor/unidade são bloqueados.** O que fica gravado num caso é o NOME do setor, não o id — dois homônimos seriam indistinguíveis.

**Ninguém entra numa empresa sem escolher.** O bootstrap não cria mais "Minha Empresa" nem ativa nada. Entrar automaticamente numa empresa que o visitante não criou confundia demonstração com produção e fazia um ambiente vazio parecer uma operação impecável.

**"Sem dados" nunca é apresentado como "sem problemas".** É a distinção mais importante para um cliente novo: um zero ambíguo faz uma empresa vazia parecer perfeita.

**O progresso de onboarding é derivado, nunca salvo.** Um flag "concluído" mentiria assim que alguém apagasse a última escala.

**Nenhum login falso — e agora nenhum login pela metade.** O login existe ponta a ponta: scrypt, sessão em cookie `HttpOnly`, expiração, papéis. O que NÃO existe (recuperação de senha, verificação de e-mail, envio de convite) continua sendo dito como não existente, em vez de virar um botão que promete e não entrega.

**A sessão saiu do `localStorage`.** Um token ali é legível por qualquer script que consiga executar na página — um XSS não só agiria em nome da vítima, como **levaria a sessão embora**. O cookie `HttpOnly` fecha isso. O preço foi exigir mesma origem entre página e API, resolvido pelo proxy do Vite em desenvolvimento e pela topologia de deploy em produção.

**Carregar assíncrono, ler síncrono.** É a decisão que permitiu ligar treze telas ao servidor sem reescrevê-las. Documentada em [FRONTEND_BACKEND.md](FRONTEND_BACKEND.md), com o custo declarado: a empresa é carregada inteira.

**Nada de interface otimista.** A tela só mostra o valor novo depois que o servidor confirmou. Antecipar exigiria saber desfazer, e um desfazer silencioso num sistema de auditoria é pior que meio segundo de espera.

**Conflito não é erro.** Quando alguém alterou o mesmo registro, a resposta é "recarregue", não "tente de novo". Tratar os dois igual levaria alguém a insistir no botão e sobrescrever o trabalho do colega.

**O motor HE não fala com a API.** O envio é um adaptador ao redor dele, e explícito: a pessoa vê quantos dias estão para subir e clica. Enviar sozinho esconderia o momento em que o dado sai do navegador.

**Nada é migrado em silêncio.** A ferramenta de migração detecta, mostra, pede confirmação, envia, confere a contagem **lida do banco**, e só então oferece a limpeza — como passo separado.

**O tenant nunca vem do cliente.** No backend, `req.params.tenantId` só é aceito depois de `resolverTenant` confirmar que o usuário da sessão tem vínculo com ele. Sem vínculo, a resposta é **404, não 403** — 403 confirmaria que o tenant existe, e isso já é informação vazada. **Não relaxe isso para facilitar depuração.**

**Esconder botão não é autorização.** Toda permissão é verificada na rota, no servidor. O frontend pode esconder por conveniência, nunca por segurança.

**As treze telas não foram reescritas — e isso foi projetado, não sorte.** Fazer o carregamento assíncrono acontecer num lugar só, e manter a leitura síncrona lá dentro, foi o que permitiu ligar tudo ao servidor mexendo apenas nos pontos de gravação. Ver [FRONTEND_BACKEND.md](FRONTEND_BACKEND.md).

**O portfólio não importa repositório nenhum.** Não é convenção, é estrutural: não há caminho pelo qual dado de cliente chegue à vitrine.

---

## 12. Limitações reais (nada disso é esquecimento)

| Limitação | Por quê |
|---|---|
| **Ainda não está no ar** | A infraestrutura de publicação existe e foi testada (HTTPS, backup, restauração, monitoramento, reinício). Falta contratar servidor, domínio e conta de e-mail — cadastros que só o dono do produto faz. Ver [DEPLOY.md](DEPLOY.md) |
| **Sem verificação de e-mail** | Nada impede criar conta com o e-mail de outra pessoa |
| **Backup no mesmo servidor** | Se a máquina se perder, o backup se perde junto. A cópia externa é um passo de configuração |
| **Sem verificação visual automatizada** | Fluxos de tela têm teste; aparência não |
| **Sem atualização em tempo real** | Recarga manual. O sistema recusa sobrescrever alteração alheia (409), mas não avisa sozinho |
| **Empresa carregada inteira** | Adequado hoje; com anos de histórico será preciso recortar por período |
| **Limite de tentativas por processo** | Em memória. Com várias instâncias o limite efetivo se multiplica — exige Redis |
| **Pontualidade não entra no score** | O motor só expõe batidas e horário padrão como TEXTO; não há campo de atraso em minutos |
| **Magnitude da HE não pesa na priorização** | Não existe limiar configurado que diga o que é "muito" |
| **`Pendencia.recomendacao` sempre `null`** | Não existe motor de recomendação textual |
| **Pendência não guarda o nome do colaborador** | Só `colaboradorId` best-effort; após "Limpar histórico" a pendência perde a referência legível |
| **Sem workflow de revisão em etapas** | Reprovar + reabrir devolve ao fluxo normal; não há fila de revisão separada nem aprovação em níveis |
| **Sem notificação externa de SLA** | O SLA é calculado e visível; disparar e-mail/push exige backend |
| **Exportação só em CSV** | PDF/XLSX exigiriam dependência nova |
| **Fuzzy match e ciclo 28–27 fixos** | Deliberado — ver BUSINESS_RULES.md |
| **Sem 2FA, sem expiração por inatividade, sem revogar todas as sessões** | Listados em SECURITY.md |
| **Dias processados sem controle de versão** | Reprocessar sobrescreve (comportamento desejado); `caseState` é preservado |

---

## 13. Como configurar uma empresa nova

1. **Configurações → Empresas** → digite o nome → **Criar empresa**. Ela já vira a ativa.
2. **Empresa** — nome, CNPJ, identificação, logo, status.
3. **Unidades** — filiais/bases (pule se for operação única).
4. **Setores** — viram as opções ao classificar uma pendência, aqui e dentro do motor.
5. **Escalas** — horário padrão. **Sem isso o sistema não consegue julgar nenhuma jornada.**
6. **Colaboradores** — permite ligar registros a setor e unidade nos indicadores.
7. **Regras** — os 7 parâmetros. Ajuste a tolerância e a meta diária antes de operar.
8. **Usuários** — quem vai operar. Aparecem como opções de responsável.
9. **Integrações** — confira as fontes (só importação de arquivo funciona hoje).
10. **Assistente HE Diário** — suba os 4 arquivos do primeiro dia.

A aba **Empresas** mostra o que ainda falta em cada empresa — use como checklist.

---

## 14. Como testar

`npm run test:all` — **318 testes** (175 de regra de negócio e interface, 143 de backend). O roteiro manual abaixo cobre o que teste automatizado não alcança:

**Isolamento (o mais importante):** crie uma empresa, mude a tolerância só nela, confirme que as outras continuam no valor anterior. Confirme que ela não vê registros nem usuários do Demo. Exclua e verifique que não sobrou chave no `localStorage`.

**Ciclo operacional (no Demo):** Centro de Ações → Abrir → atribuir responsável → sugerir prazo padrão → justificar → marcar resolvido → reabrir a ficha → aprovar com observação. Confira cada passo em Auditoria.

**SLA:** mude o prazo de uma pendência aberta para ontem (vencido), hoje (próximo), semana que vem (dentro) e confirme o badge.

**Regras no motor:** abra o Assistente HE Diário e verifique a querystring do iframe — as 5 regras devem estar lá.

**Relatórios:** gere os 7, exporte um CSV e abra no Excel (deve ter acentuação correta e colunas separadas).

**Regressão:** navegue pelas rotas com o console aberto, na empresa real e na demonstração. Recarregue e confirme que tudo persistiu.

**O fluxo que define a Fase 4:** criar conta → empresa nasce vazia → cadastrar algo → **sair da conta** → entrar de novo → o cadastro continua lá. Se isso quebrar, algo fundamental quebrou.

**Servidor fora do ar:** derrube a API com o sistema aberto e clique em recarregar. Deve aparecer "Não foi possível conectar ao servidor" com a opção de voltar — nunca tela vazia, nunca dado salvo local fingindo que sincronizou.

**Programa piloto:** com `JORNADA_CADASTRO_ABERTO=0`, o portão não oferece "criar minha empresa" e explica o piloto; `npm run piloto suspender` derruba as sessões e bloqueia o acesso mostrando "seus dados estão preservados"; `npm run piloto reativar` devolve tudo intacto; um convite gerado pela CLI vira conta nova em `/convite` mesmo com o cadastro fechado. Coberto por `server/piloto.test.js` (10 testes) e por 3 testes de interface.

**Isolamento (automatizado):** `npm run test:server` inclui 33 testes que criam dois tenants e verificam que cada um só enxerga o próprio dado, e que acesso cruzado devolve **404** — não 403.

**Depois de publicar:** `npm run smoke -- https://seu-dominio` faz 31 verificações contra a URL real — HTTPS, cookie com os atributos certos, persistência entre sessões, isolamento, permissões e prontidão. É o que separa "o código funciona" de "o deploy funciona".

**Responsividade:** reduza para 375px — não deve haver rolagem horizontal na página.

---

## 15. Como continuar

**Se for adicionar um indicador:** vá em `analyticsService`, devolva `IndicadorExplicado` com `comoFoiCalculado` e `porqueAparece` preenchidos, e `null` quando não houver dado. A tela renderiza sozinha via `CardIndicador`.

**Se for adicionar um relatório:** adicione a `TipoRelatorio`, escreva o gerador em `reportService` reaproveitando os services existentes, e registre em `RELATORIOS` e `GERADORES`. A tela e o CSV funcionam sem alteração.

**Se for adicionar uma regra configurável:** adicione o campo em `Rules`, o default em `regrasPadrao()`, o input em `RegrasTab`, e — se o motor precisar dela — a querystring em `MotorHE.tsx` e o `numeroDaQuerystring` correspondente no motor.

**Se for adicionar um tipo de dado por empresa:** crie a chave com `APP_PREFIX{workspaceId}:`, e **atualize `workspaceService.excluirWorkspace()`** — senão a exclusão deixa dado órfão.

**Se for adicionar um projeto ao portfólio:** acrescente um objeto ao array `PROJETOS` em `src/portfolio/projetos.ts`. Nenhuma tela muda. Ver [PORTFOLIO.md](PORTFOLIO.md).

**Se for adicionar um passo ao onboarding:** acrescente ao array em `onboardingService.calcularProgresso()`, com `concluido` derivado do cadastro (nunca de um flag) e `porque` preenchido.

**Se for adicionar uma rota na API:** declare a permissão em `server/lib/permissoes.js`, e monte a rota com `autenticar → resolverTenant → exigirPermissao`, nessa ordem. Nunca leia `tenantId` do corpo da requisição. Se a rota grava cadastro, envolva com `gravarCadastro` para o controle de versão não ser esquecido.

**Se for adicionar uma operação de dados:** acrescente ao contrato em `src/data/tipos.ts` e implemente nos DOIS conjuntos. O TypeScript recusa uma implementação incompleta — é essa recusa que impede a demonstração e a empresa real divergirem.

**Se for gravar algo numa tela:** use `gravar(...)` do contexto (que grava e recarrega) com `useGravacao` para o feedback. Nunca chame `fetch` nem `localStorage` direto.

**Se for mexer no acesso comercial (liberar/suspender/feedback):** o estado vive em `server/repositories/pilotoRepository.js` e a operação em `scripts/piloto.js`. **Não crie rotas HTTP que atravessem empresas** — foi exatamente para evitá-las que a CLI existe. Ver [PILOTO.md](PILOTO.md) §8.

**Próximos passos recomendados, em ordem:**

0. **Colocar os primeiros clientes usando** — o desenvolvimento estrutural está interrompido de propósito. Ver [PILOTO.md](PILOTO.md).
1. **Contratar servidor, domínio e conta de e-mail, e publicar.** Cerca de 40 minutos, sendo a maior parte espera de DNS. Ver [DEPLOY.md](DEPLOY.md).
2. **Apontar um monitor externo** para `/api/prontidao` (10 minutos, plano gratuito) — é o que avisa quando o backup para de rodar.
3. **Cópia dos backups para fora da máquina.**
4. **Recorte por período** no carregamento, quando o volume justificar.
5. **Integrações reais** (Cobli, sistema de ponto) — o contrato está pronto e o servidor já é o lugar da credencial.

---

## 16. Onde ler mais

| Arquivo | Quando consultar |
|---|---|
| [PILOTO.md](PILOTO.md) | Operar o programa piloto: liberar, convidar, acompanhar, suspender, reativar, feedback |
| [BUSINESS_RULES.md](BUSINESS_RULES.md) | Antes de mexer em qualquer cálculo. Toda regra e toda limitação estão lá |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Camadas, estrutura, storage, motor |
| [CURRENT_STATE.md](CURRENT_STATE.md) | O que está IMPLEMENTADO vs PREPARAÇÃO vs PENDENTE, item por item |
| [CONFIGURATION.md](CONFIGURATION.md) | Passo a passo de empresa nova e o dia a dia da operação |
| [ROADMAP.md](ROADMAP.md) | O que já foi feito e o que vem |
| [CHANGELOG.md](CHANGELOG.md) | Como se chegou até aqui, fase por fase |
| [DEMO.md](DEMO.md) | Ambiente de demonstração e as quatro camadas que o isolam |
| [PRODUCT.md](PRODUCT.md) | Visão de produto, princípios e conceito de planos |
| [SAAS_ARCHITECTURE.md](SAAS_ARCHITECTURE.md) | O que falta para multi-tenant real: backend, banco, autenticação |
| [ONBOARDING.md](ONBOARDING.md) | Primeiro acesso, criação de empresa, estados vazios |
| [PORTFOLIO.md](PORTFOLIO.md) | Vitrine e como adicionar projetos |
| [INTEGRATIONS.md](INTEGRATIONS.md) | Contrato de integração e adapters |
| [AUTH.md](AUTH.md) | Login, sessão em cookie, papéis, convites — e o que ainda não existe |
| [FRONTEND_BACKEND.md](FRONTEND_BACKEND.md) | Como a interface conversa com o servidor, e o que a decisão custou |
| [BACKEND.md](BACKEND.md) | API, banco, RBAC, modelo de dados |
| [SECURITY.md](SECURITY.md) | O que está protegido, como, e o que ainda não está |
| [DEPLOY.md](DEPLOY.md) | Publicar: do servidor vazio à URL do cliente |
| [OPERACAO.md](OPERACAO.md) | Plantão: backup, restauração, atualização, o que fazer quando algo quebra |
| [MIGRACAO_LOCALSTORAGE.md](MIGRACAO_LOCALSTORAGE.md) | Levar ao servidor dados que ficaram no navegador |
| [MIGRACAO.md](MIGRACAO.md) | Situação de cada repositório |
