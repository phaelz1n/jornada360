# Roadmap

> **Onde o projeto está agora:** *Jornada360 — MVP Comercial / Programa Piloto* (concluído em 2026-08-15).
> As seções abaixo são o histórico de como se chegou aqui; a última seção é o que vem depois.
> A instrução vigente é **interromper o desenvolvimento estrutural** e deixar os primeiros clientes
> usarem o produto — o que sair da validação define a próxima fase, não o inverso.

## Fase 1 — Fundação (concluída)

Transformação de sistema de uma empresa só, com regras fixas no código, em plataforma configurável e portátil:

- Camadas Interface → Serviços/Domínio → Repositórios → localStorage (pronta pra evoluir pra API sem reescrever telas).
- Conceito de Workspace (empresa configurada): Empresa, Unidades, Setores, Colaboradores, Escalas, Regras, Integrações, Usuários — tudo editável pela interface, nada fixo no código.
- Ambiente Real e ambiente Demonstração (5 colaboradores fictícios, 12 dias de dados), com isolamento completo de namespace e alternância visível (🟢/🟣).
- Motor de tolerância/HE/reincidência/score movido para `src/services/`, parametrizado pela configuração do workspace (nunca mais uma constante fixa no código).
- Camada de integrações com contrato único (`IntegrationAdapter`) e 4 adapters (1 real, 3 stub documentados).
- Trilha de auditoria persistida por workspace.
- Documentação completa (este conjunto de arquivos).

## Fase 1.1 — Consolidação da fundação (concluída)

Uma auditoria pós-Fase 1 encontrou repositórios e services implementados mas sem consumidor real na UI (código morto, não código malicioso — mas não era o que estava sendo comunicado). Esta etapa religou tudo, sem inventar uso artificial:

- `CompanyRepository`/`UnitRepository`/`DepartmentRepository`/`EmployeeRepository`/`ScheduleRepository`: as 5 telas de Configurações passaram a chamar cada um especificamente, em vez de um `atualizarWorkspace()` genérico.
- `OvertimeRepository`/`overtimeService`: religados em Horas Extras (`resumoPorColaborador`) e na ficha de pendência (`calcularHoraExtraDoDia`).
- `PendingRepository`: única porta de entrada pra editar/resolver uma pendência (`useHEEngineData.marcarCampo` passou a chamá-lo).
- `journeyService`: analisado e **deixado como preparação explícita pra Fase 2** (não tinha uso real que fizesse sentido criar agora sem inventar comportamento — ver BUSINESS_RULES.md).
- `SETOR_OPTS`/`CAUSA_OPTS` unificados numa fonte só: setor é derivado de `DepartmentRepository`, causa é um campo configurável de verdade (antes só existia no seed) — e o motor real (`public/motor-he/index.html`) passou a receber as duas listas via querystring em vez de ter sua própria lista fixa.
- Defaults de workspace novo deixaram de herdar os valores da operação atual (meta diária nasce em 0, causas ficaram genéricas, horário de escala nasce vazio) — o que é exemplo/demo agora só existe dentro de `src/demo/seedDemo.ts`, claramente rotulado.
- Data fixa no rodapé da Sidebar trocada pela data real do sistema.
- Estratégia de storage (`jornada360:workspaces` vs `assistente_he_local_{workspaceId}_...`) avaliada e documentada em ARCHITECTURE.md — decisão consciente de não migrar agora (sem benefício real, risco de perder config já configurada sem um passo de migração).

## Fase 2 — Inteligência operacional (em andamento)

Foco em enriquecer a análise sobre a fundação já pronta, em etapas pequenas e independentes (uma por vez, com aprovação explícita entre elas):

- ✅ **Etapa 1 — Taxonomia de status unificada** (concluída): `domain/Pendencia.ts` + `pendingClassificationService.statusDoCaso()` + badge em Pendências. Ver [BUSINESS_RULES.md](BUSINESS_RULES.md#taxonomia-de-status-unificada-fase-2-etapa-1) para a regra de derivação e as limitações documentadas (Aprovado/Reprovado ainda não são deriváveis — falta um campo de decisão de revisão que não existe hoje). Ainda **não** aplicada em Controle de Ponto nem em outras telas — só em Pendências, conforme escopo da etapa.
- ✅ **Etapa 2 — Pendência como entidade real** (concluída): `domain/Pendencia.ts` (entidade completa) + `PendingRepository` (persistência própria, `jornada360:{workspaceId}:pendencias`) + `pendenciaService` (materialização a partir do motor, sem duplicar cálculo). Ver [BUSINESS_RULES.md](BUSINESS_RULES.md#pendência-como-entidade-própria-fase-2-etapa-2). Prioridade manual (sem algoritmo automático), `colaboradorId`/`recomendacao`/`responsavelId`/`prazo` neutros/best-effort por decisão explícita — documentado, não inventado.
- ✅ **Etapa 3 — Centro de Ações / Fila operacional** (concluída): tela em `/centro-de-acoes` — resumo (abertas/alta prioridade/críticas/resolvidas), filtros (status/prioridade/data/colaborador via cruzamento com dado ao vivo), fila ordenada por prioridade+data, "Abrir" navega pra `/pendencias?abrir=<id>` (deep-link, sem duplicar edição/resolução). Ver [BUSINESS_RULES.md](BUSINESS_RULES.md#centro-de-ações--fila-operacional-fase-2-etapa-3). Filtro por tipo/origem e colunas de prazo/responsável não implementados (sem dado real ainda).
- ✅ **Etapa 4 — Explicabilidade da Pendência** (concluída): bloco "Por que isso apareceu?" no modal de `/pendencias` (reaproveitado pelo Centro de Ações via deep-link), gerado por `pendingExplanationService.explicarPendencia` — Motivo/Regra aplicada/Resultado/Dados considerados/Evidências/Origem, sem recalcular nada e sem inventar valor pra dado ausente ("Não disponível" em todo campo que não existe). Ver [BUSINESS_RULES.md](BUSINESS_RULES.md#explicabilidade-da-pendência--por-que-isso-apareceu-fase-2-etapa-4).
- ✅ **Etapa 5 — Priorização Operacional** (concluída): `priorizacaoService.recomendarPrioridade` sugere prioridade (Média/Alta/Crítica, nunca Baixa) a partir de status + reincidência (`workspace.rules.recurrenceLimit`, já configurável desde a Fase 1) — determinística, nunca persistida, nunca sobrescreve a prioridade manual sozinha. Ver [BUSINESS_RULES.md](BUSINESS_RULES.md#priorização-operacional--recomendação-de-prioridade-fase-2-etapa-5). Magnitude do excedente e idade da pendência avaliadas e descartadas por falta de limiar configurado (não inventado).
### Bloco 1 — Operação (concluído): Etapas 6, 7 e 8

Executadas em bloco (sem parada entre elas), fechando o ciclo operacional completo da Pendência:

- ✅ **Etapa 6 — Responsável + prazo**: `Pendencia.responsavelId` (referencia `UserAccess` de `workspace.users` — nenhuma entidade nova criada) e `Pendencia.prazo`, ambos persistidos e auditados. Novos parâmetros configuráveis `prazoPadraoDias`/`alertaAntecedenciaDias` com defaults neutros. Ver [BUSINESS_RULES.md](BUSINESS_RULES.md#responsável-e-prazo-fase-2-etapa-6).
- ✅ **Etapa 7 — SLA / acompanhamento**: `slaService.calcularEstadoSla` com 6 estados (sem prazo / dentro / próximo / vencido / resolvida dentro / resolvida fora), badge na ficha e na fila, card "Vencidas" no Centro de Ações, nota de prazo na explicação. Ver [BUSINESS_RULES.md](BUSINESS_RULES.md#sla--acompanhamento-de-prazo-fase-2-etapa-7).
- ✅ **Etapa 8 — Aprovação / reprovação**: `aprovado`/`reprovado` finalmente têm produtor — revisão humana explícita a partir de `justificado`, com quem/quando/observação persistidos, proteção contra sobrescrita pela sincronização, e reabertura para casos reprovados. Ver [BUSINESS_RULES.md](BUSINESS_RULES.md#aprovação--reprovação--revisão-da-resolução-fase-2-etapa-8).

### Bloco Analítico (concluído)

- ✅ **Dashboard Executivo** — `analyticsService` + tela `/`: pontos de atenção acionáveis, 6 indicadores de qualidade com explicação individual, evolução temporal (dia/mês), painel de pendências/SLA/revisão, 4 rankings, principais causas e indicadores por unidade. Todo indicador sem dado devolve "—" com o motivo.
- ✅ **Score multidimensional** — 5 dimensões reais (conformidade, registros completos, regularidade de jornada, confirmação por rastreio, tratamento), peso igual documentado, dimensão não medida sai da média em vez de zerar. Composição visível por colaborador.

### Bloco de Consistência (concluído)

- ✅ Dashboard, Controle de Ponto e Análise por Setor deixaram de importar `heAggregations` direto — passam por `analyticsService`. Nenhuma tela reimplementa classificação.
- ✅ Taxonomia de status unificada aplicada em Pendências, Centro de Ações, Controle de Ponto e Análise por Setor.
- ✅ Terminologia normalizada: "Motorista" → "Colaborador" em toda a interface (era vocabulário de transportadora, prendia o produto a um ramo).

### Regras de jornada (concluído)

- ✅ `intervalMinMin` e `interjourneyMinHours` saíram do valor fixo do motor e passaram a vir do workspace. `META_MIN` (36:50 de uma operação real) e `LIMITE_REINCIDENCIA` também foram parametrizados.
- ✅ Cálculo de intervalo intrajornada criado no motor; `journeyService` virou a porta de leitura desses alertas, com consumidor real em 4 lugares.

### Portabilidade multiempresa (concluído)

- ✅ Criar/excluir empresa pela interface (Configurações → Empresas), com defaults neutros, sem herdar nada da anterior, e limpeza completa de todos os namespaces ao excluir. Real e Demo protegidos.
- ✅ Diagnóstico de prontidão por empresa ("o que falta configurar").

### Relatórios (concluído)

- ✅ `reportService` + tela `/relatorios`: 7 relatórios (pendências, horas extras, divergências, por colaborador, por setor, reincidência, auditoria), período por mês/ciclo/tudo, exportação CSV com escopo e auditoria da exportação.

### Fase 2 — o que ainda falta

- **Centro de Ações — próximas melhorias**: mais ações na ficha (registrar abono, ver histórico completo do colaborador), workflow de retrabalho em múltiplas etapas (hoje reprovar+reabrir devolve o caso ao fluxo normal, sem fila de revisão separada nem aprovação em níveis).
- **Notificações de SLA** (e-mail/WhatsApp/push quando um prazo vence ou se aproxima) — o SLA já é calculado e visível; disparar aviso externo é etapa futura.
- **Explicabilidade — próximas melhorias**: reconstruir o motivo específico (não genérico) pra casos já resolvidos; embutir um resumo da explicação diretamente no Centro de Ações (hoje exige ir a `/pendencias` via deep-link).
- **Priorização e score — próximas melhorias**: um limiar configurável de magnitude do excedente, e um campo estruturado de atraso em minutos produzido pelo motor (hoje só existe como texto) — os dois destravariam, respectivamente, o sinal de gravidade na priorização e a dimensão de pontualidade no score.
- **Pesos configuráveis do score** — hoje todas as dimensões têm peso igual, por decisão explícita. Quando o negócio definir pesos diferentes, eles entram em `Rules`.
- **Snapshot do nome do colaborador na Pendencia** — hoje só existe `colaboradorId` (best-effort, pode ser `null`); sem um retrato textual, uma Pendencia órfã (após "Limpar histórico") perde a referência legível a quem ela era sobre.
- **Painel "por que isso apareceu" padronizado**, reaproveitado em todas as telas que mostram uma ocorrência (hoje só existe no detalhe de Pendências).

## Consolidação Produto + Portfólio (concluída)

Transformação do sistema funcional em algo que se apresenta como produto e como portfólio, sem alterar nenhuma regra de negócio.

- ✅ **Portão de entrada** (`/bem-vindo`): três caminhos explícitos (criar empresa / ver demonstração / já tenho acesso). O bootstrap deixou de criar "Minha Empresa" automaticamente — instalações novas recebem só o ambiente de demonstração, e ninguém entra numa empresa sem escolher. Compatibilidade preservada para quem já usava. Ver [ONBOARDING.md](ONBOARDING.md).
- ✅ **Onboarding derivado** (`onboardingService`): 9 passos com barra de progresso, próximo passo destacado com o motivo, deep-link para a aba certa. O progresso é recalculado do cadastro real — não existe flag "concluído" que possa mentir.
- ✅ **Estados vazios diferenciados**: "seu ambiente ainda não possui dados" deixou de ser confundido com "operação sem pendências". Aplicado em 9 telas.
- ✅ **Blindagem do seed**: `seedDemoWorkspaceIfEmpty` recusa qualquer workspace cujo `environment` não seja `demo` — dado fictício não pode chegar a uma empresa real nem por chamada equivocada.
- ✅ **Portfólio** (`/portfolio`) e **apresentação** (`/apresentacao`): telas públicas, fora do shell, que não acessam repositório nenhum. Catálogo de projetos é um arquivo de dados expansível. Ver [PORTFOLIO.md](PORTFOLIO.md).
- ✅ **Separação sessão × empresa** no contexto: `useSessao()` (empresa pode ser null) e `useWorkspace()` (garantida). As 13 telas operacionais não precisaram mudar.
- ✅ **Documentação de produto**: [PRODUCT.md](PRODUCT.md), [SAAS_ARCHITECTURE.md](SAAS_ARCHITECTURE.md), [ONBOARDING.md](ONBOARDING.md), [PORTFOLIO.md](PORTFOLIO.md).

## Fase 3 — Fundação de produção (parcialmente concluída)

- ✅ **Testes automatizados** (Vitest): 152 testes de regra de negócio no frontend + 54 no backend. Cobrem tolerância, HE, jornada, status, pendência, prioridade, SLA, revisão, score, indicadores, relatórios, onboarding, isolamento entre empresas e blindagem do Demo.
- ✅ **Backend** (Node + Express + SQLite): camadas routes → services/repositories → db, migrations idempotentes, seed de demonstração separado. Ver [BACKEND.md](BACKEND.md).
- ✅ **Banco com `tenant_id` em toda tabela** — 13 tabelas, `ON DELETE CASCADE` a partir de tenants.
- ✅ **Autenticação real**: scrypt, sessões com hash, expiração. Nenhum login falso.
- ✅ **Multi-tenancy server-side**: tenant derivado da sessão, nunca do cliente. IDOR devolve 404. Provado por 25 testes de isolamento entre dois tenants.
- ✅ **RBAC efetivo**: 11 permissões × 5 papéis, aplicado nas rotas — não só escondendo botão.
- ✅ **Auditoria server-side**: autor vem da sessão.
- ✅ **Code splitting**: bundle inicial de 798 KB → 255 KB (-68%).
- ✅ **Migração das telas para a API** — concluída na Fase 4.

## Fase 4 — Integração real frontend + backend (concluída)

O objetivo era um só: a interface deixar de ser um aplicativo local com backend paralelo e passar a ser uma aplicação conectada.

- ✅ **Autenticação no frontend**: `AuthProvider` com três estados (verificando / autenticado / anônimo), telas de login, criação de conta e entrada em outra empresa.
- ✅ **Sessão em cookie `HttpOnly`** — o token saiu do `localStorage`, onde um XSS conseguiria lê-lo e levá-lo embora. Proxy do Vite mantém tudo na mesma origem. Ver [AUTH.md](AUTH.md).
- ✅ **Proteção contra CSRF**, exigida em toda escrita autenticada por cookie.
- ✅ **Padrão assíncrono único**: `useRecurso`, `useGravacao` e componentes de estado — nenhuma tela inventou o próprio.
- ✅ **Fábrica de repositórios**: demonstração usa o conjunto local, empresa real usa o remoto. A escolha acontece uma vez; nenhuma tela pergunta em qual modo está.
- ✅ **Services sem I/O** — as regras calculam e devolvem; quem grava é a camada de dados. As mesmas regras valem nos dois caminhos.
- ✅ **RBAC refletido na interface**, a partir da matriz do servidor. Continua sendo o backend quem autoriza.
- ✅ **Concorrência otimista** — gravação recusada com 409 quando alguém alterou o registro no meio, em vez de sobrescrever em silêncio.
- ✅ **Gestão de acesso**: vincular quem já tem conta, convites nominais de uso único, proteção do último administrador.
- ✅ **Limite de tentativas** em login e criação de conta.
- ✅ **Migração explícita dos dados locais** — detectar, confirmar, enviar, conferir, e só então oferecer a limpeza. Ver [MIGRACAO_LOCALSTORAGE.md](MIGRACAO_LOCALSTORAGE.md).
- ✅ **Motor HE intocado** — o envio ao servidor é um adaptador ao redor dele, explícito e visível.
- ✅ **Testes de interface e ponta a ponta**: 19 de interface + 35 de fluxo completo + 14 de segurança.
- ⏳ **Publicação** — HTTPS, backup, recuperação de senha e monitoramento continuam sendo requisitos de produção não atendidos. Ver [DEPLOY.md](DEPLOY.md).
- Exportação em **PDF/XLSX** além do CSV já existente (exigiria uma dependência nova — CSV foi escolhido justamente por não exigir).
- Validação de importação com contagem de erros exibida na UI (o adapter `FileImportIntegration` já retorna isso — falta expor melhor em `ImportarDados.tsx`).
- RBAC completo: cada papel (Administrador/RH/Gestor/Auditor/Visualizador) realmente restringindo o que aparece/pode ser feito em cada tela — hoje o cadastro de papéis é só organizacional, e não há login para sustentá-lo.
- **Code splitting** — o bundle passou de 700 KB; separar Recharts, o iframe do motor e as telas públicas por rota reduziria bastante o carregamento inicial.
- Ciclo de fechamento configurável (hoje fixo em 28–27).
- **Portfólio com múltiplos projetos**: página de detalhe por projeto (`/portfolio/:id`) quando o catálogo crescer — a estrutura de dados já suporta (cada projeto tem `id`, e `buscarProjeto()` existe).
- **Onboarding guiado passo a passo** (assistente em tela cheia) como alternativa ao painel de progresso atual, se a configuração inicial se mostrar difícil na prática.

## Fase 4 — Backend real (fora do escopo atual)

Documentado, não iniciado — depende de decisão de infraestrutura/hospedagem:

- API + backend (Node/Express ou similar) + banco de dados (Postgres/SQLite).
- Autenticação real (login, sessão/JWT) — só aí o RBAC vira controle de acesso de verdade.
- Integrações reais via API (Cobli, sistemas de ponto) com credenciais geridas por variável de ambiente/cofre.
- Sincronização/backup entre dispositivos (hoje os dados vivem só no `localStorage` do navegador de quem está usando).
- Automações agendadas: importação, cruzamento e fechamento diário/mensal disparados sozinhos, sem alguém abrir o sistema pra rodar.

Graças à camada de repositórios da Fase 1, essa fase é a única que exige mudança de arquitetura — e mesmo assim, só na implementação dos repositórios, não na interface.


## MVP Comercial / Programa Piloto (concluída — 2026-08-15)

Ajuste de objetivo, não de arquitetura: a primeira versão comercial é uma **venda piloto**.

- ✅ **Cadastro fechado em produção** — `/registrar` e `/tenants` recusam com 403; `GET /api/auth/modo` deixa a interface dizer a verdade em vez de supor.
- ✅ **Conta a partir de convite** (`/convite`) — a porta de entrada de quem foi chamado por um cliente liberado, com o cadastro fechado para todo o resto.
- ✅ **Suspender e reativar preservando os dados** — 403 `empresa_suspensa`, sessões encerradas, nada apagado, tudo volta.
- ✅ **Feedback dentro do produto** — cinco categorias, tela atual anexada, isolado por empresa.
- ✅ **CLI do operador** (`npm run piloto`) — liberar, convidar, acompanhar, suspender, reativar, ler feedback. No servidor, não pela rede.
- ✅ **318 testes**, `PILOTO.md` escrito, produto reclassificado.

## Depois da validação com os clientes piloto

Nada aqui deve ser construído antes de os primeiros clientes usarem o produto e dizerem o que falta. A ordem provável, se a validação confirmar:

1. **Verificação de e-mail** na criação de conta (hoje declarada como ausente, não simulada).
2. **Cópia externa dos backups** — hoje o backup vive no mesmo servidor; ver [DEPLOY.md](DEPLOY.md).
3. **Cobrança**, se e quando o número de clientes tornar o controle manual caro — não antes.
4. **Painel de operação** substituindo a CLI, se o número de empresas justificar as rotas cruzadas que ele exige.
5. **Integrações reais** (Cobli, sistemas de ponto), guiadas pelo que os clientes efetivamente usam.
6. **Exportação em PDF/XLSX**, atualização em tempo real, ciclo de fechamento configurável.
