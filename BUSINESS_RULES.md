# Regras de negócio

## Regra de tolerância (o coração da classificação)

```
Padrão (horário configurado)  x  Registro (ponto batido)
        │
        ▼
Diferença = Registro − Padrão
        │
        ▼
Diferença ≤ Tolerância configurada  →  Normal (dentro do padrão)
Diferença  > Tolerância configurada  →  Divergência (acima do padrão)
```

Exemplo real do sistema: padrão `05:40`, registro `05:57` → diferença de 17 minutos. Com a tolerância padrão de 10 minutos configurada, isso é classificado como **Divergência**.

Implementada em `src/services/toleranceService.ts` (chama `reclassificar()` em `src/engine/heEngineCore.ts`). **Nunca é um valor fixo** — todo chamador recebe a tolerância de `workspace.rules.toleranceMin`, editável em Configurações → Regras. Mudar esse número reclassifica todos os casos já processados na hora, só no workspace ativo.

## Horas extras

- **HE realizada** — o que o ponto/motor apurou no dia (`he1min`, com prioridade para uma correção manual se o analista tiver ajustado — `heEfetivo()`).
- **HE programada** — o extra normal previsto no horário padrão cadastrado do colaborador (`padraoMin`).
- **HE excedente** — `HE realizada − HE programada`, só quando positivo e acima da tolerância.
- Classificação: **dentro do padrão** (excedente ≤ tolerância), **acima do padrão** (excedente > tolerância), **sem padrão cadastrado** (colaborador não encontrado na planilha de horário padrão) ou **padrão inválido** (dado da planilha não confiável).

Implementado em `src/services/overtimeService.ts`, com duas portas de entrada: `resumoPorColaborador(dias)` (agregado, usado pela tela Horas Extras — delega em `heAggregations.agregarPorMotorista`, não recalcula) e `calcularHoraExtraDoDia(workspaceId, dateKey, colaborador, toleranceMin)` (pontual, usado pela ficha de pendência — busca o item via `OvertimeRepository`).

## Reincidência

Conta quantos dias, num período, um colaborador ficou "acima do padrão". Sinaliza como crítico quem passar do limite configurado (`workspace.rules.recurrenceLimit`, padrão 5) — usado no Ranking de Reincidência e no Relatório por Período. Implementado em `src/services/recurrenceService.ts`.

## Score multidimensional do colaborador

`src/services/scoreService.ts`. O score geral é a **média simples** das dimensões que puderam ser medidas para aquele colaborador.

| Dimensão | Como é calculada | Denominador |
|---|---|---|
| Conformidade com o padrão | Dias dentro da tolerância configurada | Dias com padrão cadastrado |
| Registros completos | Dias com horário padrão cadastrado e legível | Todos os dias analisados |
| Regularidade de jornada | Dias sem alerta de interjornada nem de intervalo | Todos os dias analisados |
| Confirmação por rastreio | Dias em que o rastreio confirmou as batidas | Dias com rastreio disponível |
| Tratamento das ocorrências | Ocorrências já marcadas como resolvidas | Ocorrências desse colaborador |

**Peso igual é decisão explícita, não descuido.** Qualquer outro conjunto de pesos seria um juízo de valor que o negócio ainda não tomou ("faltar padrão cadastrado é duas vezes pior que furar o descanso?" não tem resposta no sistema). Quando a empresa definir esses pesos, eles viram configuração em `Rules` — a estrutura já isola cada dimensão para isso.

**Dimensão não medida sai da média, não entra como zero.** Zerar penalizaria o colaborador por uma lacuna de cadastro. Cada denominador acima exclui de propósito os dias em que não havia base de comparação.

**Limitações (não implementado, e por quê):**
- **Pontualidade** — exigiria comparar a batida de entrada com o início do horário padrão. O motor tem os dois valores, mas só os expõe como TEXTO (`batidas`, `padraoHorarios`); não há campo estruturado de atraso em minutos. Derivar por parsing de string seria frágil e inventaria precisão que o dado não tem.
- **Magnitude da hora extra** — o dado existe (excedente em minutos), mas não existe limiar configurado que diga quantos minutos são "muito". Mesma limitação da priorização (Etapa 5).

Ambas aparecem escritas na própria tela de Score, não só aqui.

## Setores e causas — fonte única

**Setor**: não existe uma lista separada de "opções de setor". As opções mostradas ao classificar uma pendência (na tela React e dentro do Assistente HE Diário) são **derivadas diretamente** dos setores cadastrados em Configurações → Setores (`DepartmentRepository.listNomes()`). Cadastrar um setor novo já o disponibiliza nos dois lugares, sem sincronização manual.

**Causa**: ao contrário de setor, não existe uma entidade "Causa" própria — é uma lista de texto configurável (`workspace.causaOpts`, editável em Configurações → Regras), a mesma fonte usada pelos dois lugares.

Em ambos os casos, `src/pages/MotorHE.tsx` passa a lista atual pro iframe via querystring (`?setores=...&causas=...`) — o motor real não tem mais uma lista própria fixa (ver "Três alterações deliberadas" em ARCHITECTURE.md).

## Regras de jornada — interjornada e intervalo

**Divisão de responsabilidade:** o motor real (`public/motor-he/index.html`) tem as batidas brutas do espelho, então é ele quem DETECTA a violação — comparando contra os mínimos que o workspace manda por querystring. `src/services/journeyService.ts` é a porta de leitura desse resultado para o lado TypeScript: nenhuma tela lê `item.interjornada`/`item.intervalo` na mão.

**Interjornada** — descanso entre o último ponto de ontem e o primeiro de hoje, comparado com `workspace.rules.interjourneyMinHours` (padrão 11h, referência CLT — genérica para qualquer empresa brasileira, editável para quem tem acordo coletivo diferente). Sem espelho do dia anterior, não se conclui nada.

**Intervalo intrajornada** — com 4 ou mais batidas no dia (pelo menos um ciclo entra-sai-entra-sai), a pausa é o **maior intervalo entre batidas consecutivas**, comparado com `workspace.rules.intervalMinMin` (padrão 60min). Com menos de 4 batidas não há pausa registrada no espelho: nesse caso nada é concluído, em vez de supor que a pessoa não descansou.

Os alertas aparecem na coluna "Jornada" do Controle de Ponto, entram no indicador "Alertas de jornada" do Dashboard, na dimensão "Regularidade de jornada" do score, e na ficha dentro do próprio Assistente HE Diário.

**Limitação:** `alertasDeJornada()` devolve lista vazia tanto para "nenhuma violação" quanto para "não havia dado suficiente para avaliar". O motor não marca "não avaliado" separado de "ok", e criar essa distinção do lado TypeScript seria adivinhação.

## Parâmetros configuráveis por empresa (todos)

Todos editáveis em Configurações → Regras. Nenhum é constante fixa no código, nem no motor.

| Parâmetro | Padrão | O que faz |
|---|---|---|
| `toleranceMin` | 10 min | Diferença até esse valor é considerada normal |
| `dailyGoalMin` | 0 (não configurada) | Meta diária de HE1 do time. Em 0, os painéis de meta ficam ocultos — o sistema nunca assume a meta de nenhuma empresa |
| `recurrenceLimit` | 5 dias | Quantos dias acima do padrão marcam reincidência crítica |
| `intervalMinMin` | 60 min | Pausa mínima dentro da jornada |
| `interjourneyMinHours` | 11 h | Descanso mínimo entre jornadas |
| `prazoPadraoDias` | 3 dias | Base da sugestão de prazo (nunca aplicada sozinha) |
| `alertaAntecedenciaDias` | 1 dia | Quantos dias antes do vencimento o prazo vira "próximo" |

O motor recebe os cinco primeiros por querystring (`?tol=&meta=&reinc=&interj=&intervalo=`, ver `src/pages/MotorHE.tsx`); os dois últimos são exclusivos do lado TypeScript (SLA). O iframe remonta quando qualquer regra muda, então o motor nunca segue rodando com um valor antigo.

## O que ainda NÃO é configurável (gap conhecido)

| Regra | Valor fixo hoje | Onde |
|---|---|---|
| Confiança de correspondência de nomes (fuzzy match) | 82%–90% conforme o caso | `public/motor-he/index.html`, função `bestMatch` |
| Ciclo de fechamento | dia 28 ao 27 | `src/engine/heEngineCore.ts`, `cicloKeyFor` |

Os dois são deliberados. O limiar de fuzzy match afeta a precisão do cruzamento ponto×rastreio — expô-lo como configuração convidaria a um ajuste que degrada silenciosamente a qualidade do dado, sem que quem mexeu perceba. O ciclo 28–27 é uma convenção de fechamento; torná-lo configurável é trabalho pequeno, mas ainda não houve uma segunda empresa com ciclo diferente para validar o formato do campo.

## Taxonomia de status unificada (Fase 2, Etapa 1)

`src/domain/Pendencia.ts` define `StatusPendencia`, um conceito único de status pra qualquer ocorrência, pensado pra ser usado em qualquer tela (hoje só Pendências consome): `Normal`, `Atenção`, `Divergência`, `Pendente`, `Justificado`, `Aprovado`, `Reprovado`.

`src/services/pendingClassificationService.ts` (`statusDoCaso()`) deriva esse status a partir de campos que o motor real e o `toleranceService` **já calculam** — não recalcula nada, só nomeia de forma consistente o que hoje aparece espalhado em badges diferentes por tela. A interface (`RealPendenciasSection.tsx`) só chama essa função e exibe o resultado — não interpreta `_padraoStatus`/`_status`/`_done` por conta própria.

**Regra de derivação, em ordem de precedência:**

1. `_padraoStatus === 'dentro'` → **Normal** — o motor já confirma que não há divergência.
2. `_done === true` (e o caso não é `'dentro'`) → **Justificado** — ver limitação abaixo.
3. `_padraoStatus` é `'sem_cadastro'` ou `'invalido'` → **Pendente** — não existe um padrão confiável pra comparar; não dá pra classificar a severidade da divergência, só sinalizar que a situação exige uma decisão (ex.: cadastrar o horário padrão do colaborador).
4. `_padraoStatus === 'acima'` e `_status` (confirmação por rastreio) é `'leve'` ou `'sem_dado'` → **Atenção** — o excedente existe, mas o sinal de confirmação é fraco; ainda não é uma divergência confirmada com segurança.
5. `_padraoStatus === 'acima'` e `_status` é `'forte'` ou `'ok'` → **Divergência** — excedente confirmado tanto pelo padrão configurado quanto pelo rastreio.

**Limitações conhecidas, documentadas em vez de inventadas:**

- **`Aprovado` e `Reprovado` nunca são produzidos hoje.** `HECaseState` (`heEngineCore.ts`) só tem `done: boolean` — não existe nenhum campo que registre uma decisão de revisão (aprovar/reprovar uma justificativa) separada de "marcado como resolvido". Os dois valores existem no tipo `StatusPendencia` (o conceito de domínio foi pedido explicitamente), mas ficam sem produtor até existir um campo de decisão de revisão — trabalho de uma etapa futura da Fase 2, não desta.
- **`_done === true` sem `_justificativa` preenchida ainda cai em `Justificado`.** A tela permite clicar em "Marcar resolvido" sem preencher o campo de justificativa (`RealPendenciasSection.tsx`), então `Justificado` hoje cobre tanto "resolvido com explicação" quanto "resolvido sem explicação registrada". A taxonomia de 7 valores pedida não tem um estado próprio pra "resolvido sem justificativa" — nenhum foi inventado pra preencher essa lacuna.
- **`Divergência` e `Pendente` (no sentido genérico de "fila de trabalho") não são estados irmãos no dado atual.** Toda ocorrência que não é `Normal` nem `Justificado` já está, por definição, na fila de pendências (`listarPendencias()`) — `Atenção`/`Divergência`/`Pendente` (regra 3) são sub-classificações dessa fila, não uma etapa de workflow separada anterior a ela. Não existe hoje um "visto mas ainda não triado" distinto de "está na fila".

## Pendência como entidade própria (Fase 2, Etapa 2)

A Pendência agora é uma entidade persistida (`domain/Pendencia.ts`), independente do `HECaseState` temporário do motor — id estável, workspaceId, status (taxonomia da Etapa 1), prioridade, categoria, descrição, evidências, e campos de resolução (`resolvidaEm`/`resolucao`). Persistida em `jornada360:{workspaceId}:pendencias`, via `PendingRepository` (`criarPendencia`/`buscarPendencia`/`listarPorWorkspace`/`atualizarPendencia`/`resolverPendencia`), acessada só através de `src/services/pendenciaService.ts` — nenhuma tela lê/escreve esse storage diretamente.

**Como uma Pendencia nasce/atualiza:** `pendenciaService.sincronizarPendencias(workspaceId, dias)` — chamado num `useEffect` sempre que os dias processados pelo motor mudam (`RealPendenciasSection.tsx`) — varre os casos do motor e, para cada um cujo `_padraoStatus !== 'dentro'`, cria (se não existir) ou atualiza (se existir) a Pendencia correspondente. O id é determinístico (`workspaceId + dateKey + nome normalizado`), então sincronizar de novo nunca duplica — resolve, de quebra, o gap de "id estável entre reprocessamentos" citado no ROADMAP.

**Campos com regra automática hoje:** `status` (reaproveita `statusDoCaso` da Etapa 1, sem recalcular), `categoria` (= causa provável do caso), `descricao`/`evidencias` (copiados do que o motor já produz — `item.detalhe`/`item.batidas`/`item.padraoHorarios`), `resolvidaEm`/`resolucao` (setados quando o status vira um dos "resolvidos" — hoje só `justificado` é alcançável).

**Campos neutros/nulos por decisão explícita, não por omissão:**
- `prioridade` nasce sempre `'media'` (neutra) — não existe algoritmo automático ainda. Único campo com atualização manual nesta etapa (seletor no modal de detalhe → `pendenciaService.atualizarPrioridade`), prova que a entidade é editável independente do `HECaseState`.
- `colaboradorId` é **best-effort**: tenta casar o nome do motorista (normalizado) contra `EmployeeRepository`; fica `null` se não achar — o cadastro de Colaboradores não precisa bater 1:1 com a planilha (ver CONFIGURATION.md), então `null` é comum e esperado, não um bug.
- `recomendacao`, `responsavelId`, `prazo` — sempre `null` nesta etapa. Não existe motor de recomendação, atribuição de responsável nem regra de prazo/SLA ainda; os campos existem no modelo pra não exigir migração de schema quando essas regras chegarem (Fase 2, próximas etapas).

**Limitações conhecidas:**
- `Aprovado`/`Reprovado` continuam sem produtor (ver Etapa 1) — `resolvidaEm`/`resolucao` só são alcançados hoje via `justificado`.
- Sem um snapshot textual do nome do colaborador na entidade: se `colaboradorId` for `null` e o histórico do motor for limpo depois, a Pendencia persistida perde a única referência legível a quem ela era sobre. Não fazia parte do modelo mínimo pedido nesta etapa — documentado como dívida técnica, não implementado.
- `Auditoria`: a materialização automática (sincronização) não gera entrada própria — geraria ruído a cada carregamento de tela. Reaproveita as entradas que as ações do usuário já registram (salvar caso, marcar resolvido); a única ação nova com auditoria própria é a mudança manual de prioridade.
- Sem exclusão (`excluir`) implementada — nenhuma tela tem uma ação que precise disso ainda.

## Centro de Ações — fila operacional (Fase 2, Etapa 3)

Tela em `/centro-de-acoes` (`src/pages/CentroAcoes.tsx`), consumindo exclusivamente a entidade `Pendencia` (Etapa 2) via `pendenciaService` — nenhum modelo novo, nenhuma consulta direta a repositório/storage a partir da tela. Resolução continua só em `/pendencias` (mesmo mecanismo da Etapa 2); "Abrir" navega pra lá com `?abrir=<id>`, que `RealPendenciasSection.tsx` usa pra auto-selecionar o caso certo.

**Ordenação** (`pendenciaService.ordenarPendencias`): prioridade crítica → alta → média → baixa; em empate, data mais antiga primeiro. Verificada compatível com o dado atual antes de implementar — `prioridade` nunca é null e `data` é sempre uma chave válida, sem gap.

**Resumo:** os 4 indicadores (abertas/alta prioridade/críticas/resolvidas) vêm sempre da lista **completa** do workspace (`pendenciaService.resumoPendencias`), não da fila filtrada — decisão deliberada pra os números não "pularem" só porque o usuário ajustou um filtro.

**Filtros implementados:** status (taxonomia da Etapa 1, exceto `Normal` — nunca aparece numa Pendencia, já que a sincronização pula casos dentro do padrão), prioridade, data (de/até).

**Filtro por colaborador — como foi resolvido sem inventar dado:** `colaboradorId` da entidade é best-effort e fica `null` na maioria dos casos (ver Etapa 2) — inútil pra filtro. Em vez disso, o nome exibido/filtrado vem de um **cruzamento com os dados ao vivo do motor** (`useHEEngineData().dias`, mesmo id determinístico da Etapa 2), a mesma fonte que todas as outras telas do Jornada360 já usam pra mostrar nome de colaborador. Isso é dado confiável — só não está gravado na entidade.

**Filtros NÃO implementados, por decisão explícita:** `tipo`/`origem` — hoje têm um único valor possível cada (`'divergencia_he'`/`'motor_he'`, ver Etapa 2); filtrar por um campo de valor único não filtra nada de verdade, então não foi exposto na UI.

**Colunas não exibidas:** `prazo` e `responsavelId` — sempre `null` nesta etapa (ver Etapa 2); mostrar duas colunas permanentemente vazias contrariaria o pedido de evitar excesso de informação visual. Aparecem quando um algoritmo/atribuição real existir.

**Prioridade editável direto na fila:** decisão desta etapa — o seletor de prioridade em cada linha chama `pendenciaService.atualizarPrioridade` (mesma função da Etapa 2, sem duplicar), e a mudança é registrada via `useAppState().registrarAuditoria` (infraestrutura já existente, rótulo "Atualização de prioridade (Centro de Ações)" só pra diferenciar a origem no histórico — nenhuma infraestrutura nova de auditoria foi criada).

## Explicabilidade da Pendência — "Por que isso apareceu?" (Fase 2, Etapa 4)

Bloco expansível no modal de detalhe de `/pendencias` (reaproveitado pelo Centro de Ações via deep-link — não existe uma segunda tela de explicação). Gerado por `src/services/pendingExplanationService.ts` (`explicarPendencia`), que **não recalcula nada**: só narra em português o que `overtimeService.calcularHoraExtraDoDia` (reaproveitado, não duplicado), `pendingClassificationService.statusDoCaso` (idem) e a config do workspace já produziram.

**Estrutura:** Motivo (texto simples) → Regra aplicada (só quando há padrão pra comparar) → Resultado → Dados considerados (lista label/valor) → Evidências → Origem.

**Princípio seguido à risca:** todo campo sem dado real fica `null` no service e vira "Não disponível" na interface — nunca um valor calculado/estimado no lugar. Verificado especificamente: `HE programada`/`horário padrão`/`excedente` mostram "Não disponível" (não `00:00`) quando `item.padraoMin` é `null` — o service usa o campo bruto do motor, não o `heCalculada.heProgramadaMin ?? 0` do `overtimeService` (que zera silenciosamente sem padrão, o que seria enganoso aqui).

**Como cada bloco é montado:**

| Bloco | Fonte | Nunca recalcula |
|---|---|---|
| Motivo | Texto gerado a partir de `pendencia.status` (Etapa 1) + `item._status`/`item._padraoStatus` | Não decide status, só narra o que `statusDoCaso` já decidiu |
| Regra aplicada | Fórmula descrita em texto (diferença × tolerância), com os números já calculados por `overtimeService` | Não soma/subtrai HE de novo — só formata o resultado já obtido |
| Resultado | `pendencia.status`/`prioridade`/`resolvidaEm` | — |
| Dados considerados | Campos brutos de `HEItemComputed` (motor) + `Pendencia` (entidade) | — |
| Evidências | `pendencia.evidencias` (já montado na Etapa 2) | Não gera evidência nova |
| Origem | `pendencia.origem` | — |

**Limitações documentadas:**
- `Vínculo com cadastro de Colaboradores` quase sempre "Não disponível" — mesma limitação de `colaboradorId` best-effort da Etapa 2.
- `Nota do motor sobre o rastreio`/`Nota técnica sobre o padrão` refletem `item.detalhe`/`item.padraoDebug` exatamente como o motor escreveu — quando o motor não preenche esses campos (comum), aparecem como "Não disponível", não uma frase genérica inventada.
- Para status `justificado`/`aprovado`/`reprovado`, o Motivo usa um texto genérico de "caso já resolvido, motivo original nos dados abaixo" — não tenta reconstruir a frase específica de divergência/atenção que teria sido usada originalmente (os dados brutos abaixo, sim, continuam mostrando a razão original completa).
- `aprovado`/`reprovado` têm texto de Motivo preparado, mas — como na Etapa 1 — nunca são produzidos hoje.

## Priorização operacional — recomendação de prioridade (Fase 2, Etapa 5)

`src/services/priorizacaoService.ts` (`recomendarPrioridade`) sugere uma prioridade — **nunca decide sozinha**. `Pendencia.prioridade` continua sendo o único campo de prioridade efetiva (sem campos novos `prioridadeRecomendada`/`prioridadeManual` — ver decisão arquitetural abaixo). A recomendação é **computada sob demanda a cada exibição, nunca persistida**: garante por construção que "a mesma Pendência, com os mesmos dados, produz a mesma recomendação", sem risco de ficar desatualizada.

**Sinais avaliados:**

| Sinal | Confiável hoje? | Usado? |
|---|---|---|
| Status (`StatusPendencia`, Etapa 1) | Sim | ✅ Base da recomendação |
| Reincidência (`diasAcimaPadrao` de `heAggregations.agregarPorMotorista` × `workspace.rules.recurrenceLimit`) | Sim — mesma métrica e mesmo parâmetro (já configurável por workspace desde a Fase 1) que `recurrenceService.calcularReincidencia` usa no Ranking de Reincidência | ✅ Eleva um nível quando "crítico" |
| Tolerância | Sim, mas já embutida na derivação do status — não é um sinal adicional independente | Não usado isolado |
| Magnitude do excedente (minutos) | O dado existe (`_excedenteMin`), mas **não há limiar configurado** nas regras de negócio pra distinguir "pouco" de "muito" excedente além da tolerância | ❌ Descartado — inventar um número aqui violaria a instrução de não inventar limiar. Documentado como configuração futura (ex.: um segundo limiar em `domain/Rules.ts`, tipo `excedenteGraveMin`, se algum dia for decidido) |
| Idade da pendência (`criadaEm`) | O dado existe, mas **não há limiar configurado** (nenhum SLA/prazo existe — `prazo` é sempre `null`, ver Etapa 2) | ❌ Descartado — mesma razão acima |
| Quantidade de ocorrências (contagem bruta de Pendencias do colaborador) | Redundante com reincidência — `diasAcimaPadrao` já é a métrica mais precisa e já configurada | ❌ Absorvido pela reincidência, não duplicado |
| Resolução | Sim | Usado só pra decidir que **pendências resolvidas não recebem recomendação** (`estadoResolvido`, reaproveitado da Etapa 2/3) |
| Justificativa, setor, colaborador (como sinal direto), tipo, origem | Existem, mas sem valor discriminador real de prioridade — setor nem está persistido na entidade, tipo/origem têm um valor único cada, colaborador só serve como chave pra olhar a reincidência dele | ❌ Descartados |

**Regra (determinística, dois sinais, um parâmetro):**
1. Base pelo status: `divergencia` → Alta; `atencao`/`pendente` → Média.
2. Se `diasAcimaPadrao > workspace.rules.recurrenceLimit` → eleva um nível (Média→Alta, Alta→Crítica).
3. `justificado`/`aprovado`/`reprovado` (resolvidos) → sem recomendação (`null`).
4. **"Baixa" nunca é recomendada automaticamente** — dentro do conjunto de Pendencias (que já são, por definição, casos fora do padrão) não existe hoje um sinal real que distinga baixa urgência. Continua disponível para escolha manual.

**Decisão arquitetural — por que não `prioridadeRecomendada`/`prioridadeManual` na entidade:** a sugestão do briefing foi avaliada e descartada em favor de computar a recomendação sob demanda. Motivo: persistir a recomendação exigiria decidir QUANDO recalculá-la (arriscando ficar desatualizada em relação aos dados atuais) e migrar o schema da entidade; computá-la ao vivo, a partir de dados que já existem (`status`, `dias`, `workspace.rules.recurrenceLimit`), é mais simples, sempre fresca por construção, e não exige nenhuma mudança na entidade da Etapa 2.

**Precedência:** a prioridade efetiva (`Pendencia.prioridade`) nunca é alterada automaticamente. "Aplicar" é uma ação explícita do usuário (em `/pendencias` e no Centro de Ações) que chama exatamente `pendenciaService.atualizarPrioridade` — o mesmo caminho da edição manual — e gera uma entrada de auditoria distinta ("Prioridade ajustada para recomendação do sistema", com o motivo da recomendação como motivo da auditoria), pra diferenciar de um ajuste manual livre.

**Auditoria:** só a AÇÃO de aplicar a recomendação é registrada — computar/exibir a recomendação (a cada abertura de tela) não gera nenhuma entrada, pra não gerar volume de auditoria sem uma decisão humana real por trás.

**Limitações:**
- Magnitude do excedente e idade da pendência ficam de fora até existir um limiar configurado nas regras de negócio — não é uma omissão, é a instrução explícita de não inventar.
- A recomendação depende de `dias` (dado ao vivo do motor) pra calcular reincidência — mesma dependência de "dado órfão" já documentada nas Etapas 2-4 (some se o histórico do motor for limpo).

## Responsável e prazo (Fase 2, Etapa 6)

Ambos persistidos na própria `Pendencia` (nunca só em estado de tela), editáveis na ficha em `/pendencias` via `pendenciaService.atualizarResponsavel`/`atualizarPrazo`, com auditoria própria em cada alteração.

**Responsável:** `Pendencia.responsavelId` referencia `UserAccess.id` de `workspace.users` — o cadastro de Usuários já existia desde a Fase 1 (era só organizacional, sem nada referenciando). Avaliado antes de criar qualquer entidade nova: **nenhuma foi criada**. A lista de responsáveis oferecida é a do workspace ativo, então o Real nunca vê usuários do Demo. `null` = "Sem responsável atribuído" (estado inicial de toda Pendencia).

**Prazo:** `Pendencia.prazo` (`YYYY-MM-DD`), **sempre uma decisão humana**. `pendenciaService.sugerirPrazo` calcula `criadaEm + workspace.rules.prazoPadraoDias`, mas é só uma sugestão atrás de um botão explícito ("Sugerir prazo padrão") — nunca aplicada automaticamente, mesmo princípio da recomendação de prioridade da Etapa 5. Sem prazo definido, o SLA fica `sem_prazo` e nada é inferido.

**Novos parâmetros configuráveis por workspace** (`domain/Rules.ts`, editáveis em Configurações → Regras): `prazoPadraoDias` (default neutro 3) e `alertaAntecedenciaDias` (default neutro 1). Nenhum dos dois vem da operação atual — são pontos de partida genéricos, editáveis antes de o sistema sugerir qualquer prazo. Workspaces criados antes desses campos existirem recebem o default na **leitura** (`WorkspaceRepository.listAll` espalha `regrasPadrao()` antes de `w.rules`), sem sobrescrever nada já configurado.

## SLA / acompanhamento de prazo (Fase 2, Etapa 7)

`src/services/slaService.ts` (`calcularEstadoSla`) classifica um prazo **já definido** — não inventa data-limite, não recalcula nada do motor. Seis estados:

| Estado | Regra |
|---|---|
| `sem_prazo` | `prazo === null` — nada é inferido |
| `resolvida_dentro_prazo` | pendência resolvida e `resolvidaEm <= prazo` |
| `resolvida_fora_prazo` | pendência resolvida e `resolvidaEm > prazo` |
| `vencido` | aberta e hoje > prazo |
| `proximo_vencimento` | aberta e hoje >= (prazo − `alertaAntecedenciaDias`) |
| `dentro_prazo` | aberta, nenhum dos acima |

Exibido como badge na ficha e na fila do Centro de Ações (coluna "SLA"), com card "Vencidas" no resumo. A explicação (`pendingExplanationService`) ganhou o campo `notaPrazo`, preenchido só quando o prazo é relevante (vencido — com o número exato de dias de atraso —, próximo do vencimento, ou resolvida fora do prazo); `null` nos demais casos, sem frase genérica inventada.

**Não implementado nesta etapa (deliberado):** nenhuma notificação externa (e-mail/WhatsApp/push) — o pedido era ter o SLA calculado e visível primeiro.

## Aprovação / reprovação — revisão da resolução (Fase 2, Etapa 8)

Fecha o ciclo: `aprovado`/`reprovado` existiam na taxonomia desde a Etapa 1 mas **nunca tinham produtor**. Agora têm, via decisão humana explícita.

**Fluxo:** `divergencia|atencao|pendente` → (resolver, fluxo já existente) → `justificado` → (revisar) → `aprovado` **ou** `reprovado` → (se reprovado) reabrir → volta a `divergencia|atencao|pendente`.

**"Resolvido" NUNCA vira "aprovado" automaticamente.** São decisões diferentes: o bloco de revisão só aparece na ficha *depois* que o caso está `justificado`, e exige um clique explícito em Aprovar ou Reprovar. Nada no sistema promove um status ao outro sozinho.

**Campos persistidos:** `revisadoPor` (string, mesmo padrão de `AuditEntry.usuario`), `revisadoEm` (ISO), `observacaoRevisao` (opcional). `resolvidaEm`/`resolucao` **não** são tocados pela revisão — continuam descrevendo a resolução original, que é um evento anterior e distinto.

**Proteção contra sobrescrita pela sincronização** (`pendenciaService.statusAlvoSincronizacao`): como `statusDoCaso` (Etapa 1) nunca retorna `aprovado`/`reprovado`, toda sincronização reclassificaria um caso revisado de volta pra `justificado` (o `item._done` do motor continua `true`). A sincronização agora preserva o status revisado enquanto o caso seguir resolvido no motor — a decisão humana só é abandonada quando o caso é **reaberto de verdade**.

**Reabertura (só para `reprovado`):** reabre o caso no motor pelo caminho já existente (`marcarCampo({done: false})` — nada duplicado) e limpa os campos de revisão via `pendenciaService.reabrirRevisao`. O status é recalculado pela sincronização seguinte, não escrito à mão. `prazo` e `responsavelId` são **preservados** (o trabalho continua atribuído à mesma pessoa, com o mesmo prazo); `resolvidaEm`/`resolucao` são limpos, senão a ficha continuaria dizendo "resolvido em X" numa pendência aberta e o SLA a classificaria como já resolvida.

**Limitações:**
- `revisadoPor` grava o `usuarioAtual` do `AppState` (hoje uma constante — não há login real; ver ROADMAP, Fase 4). É a mesma limitação que a auditoria já tinha desde a Fase 1, não uma nova.
- Não há workflow de retrabalho em múltiplas etapas (fila de revisão separada, aprovação em níveis, devolução com prazo novo) — o modelo atual não suporta isso sem inventar regra de negócio. Reabrir devolve o caso ao fluxo normal, e só.
- Não há restrição de quem pode aprovar/reprovar — o RBAC ainda é organizacional (Fase 3).

## Indicadores do Dashboard Executivo (Bloco Analítico)

`src/services/analyticsService.ts`. **Regra fundamental deste arquivo:** todo indicador é derivado de dado que já existe (dias processados pelo motor, Pendencias persistidas, cadastro do workspace). Nada é estimado, projetado ou preenchido por heurística. Quando um indicador não pode ser calculado, ele volta como `null` e a tela mostra "—" com o motivo — nunca um número inventado.

Cada indicador carrega sua própria explicação (`comoFoiCalculado` / `porqueAparece`), exibida no botão "?" ao lado do rótulo. O usuário nunca vê um número sem poder descobrir de onde veio.

### Qualidade da operação

| Indicador | Regra |
|---|---|
| Jornadas sem divergência | Registros cujo status não é Divergência nem Atenção ÷ total de registros |
| Registros completos | Registros com padrão cadastrado e legível ÷ total. Mede a qualidade do **cadastro**, não a do colaborador |
| HE1 acumulada | Soma da HE1 efetiva (HE corrigida manualmente substitui a original, como no motor) |
| Excedente sobre o padrão | Soma do excedente só dos registros acima do padrão |
| Alertas de jornada | Registros com violação de interjornada ou intervalo |
| Dias acima da meta | Só aparece se `dailyGoalMin > 0`. Sem meta configurada: "—" |

**"Registro completo" = havia padrão cadastrado para comparar** (`padraoStatus` é `acima` ou `dentro`). Batidas faltando individualmente **não** são contadas: o motor não expõe isso de forma estruturada, só dentro do texto de `detalhe`, e extrair por parsing seria frágil.

### Evolução temporal

Um ponto por dia processado, ordenado crescente. **Não há interpolação**: dia que não foi processado simplesmente não existe na série, em vez de aparecer como zero (o que faria parecer que houve operação sem hora extra). Acima de 45 dias a série troca automaticamente para visão mensal — escolha de apresentação, alternável na mão.

### Indicadores por unidade

O motor traz o **nome** do colaborador, não a unidade. O vínculo é feito por nome normalizado contra o cadastro de Colaboradores (mesma regra best-effort de `pendenciaService`). Quem não casa cai em **"Sem vínculo com o cadastro"**, visível de propósito: é a forma honesta de mostrar que o recorte só é confiável na medida em que o cadastro estiver completo, em vez de distribuir esses registros silenciosamente entre as unidades reais.

### Setores

`calcularPorSetor` reaproveita `agregarPorSetor` — a mesma regra de rateio da tela Análise por Setor (quando o caso passou do padrão, só o EXCEDENTE vai pro setor marcado; o resto vai pro agrupamento "Dentro do padrão"). Não existe uma segunda definição de "HE do setor".

**"Dentro do padrão" é um agrupamento sintético, não um setor da empresa** (`SETOR_DENTRO_DO_PADRAO`). Ele é excluído do ranking de divergências: um caso acima do padrão entra ali com a *parcela dentro do padrão* dele, então contá-lo como divergência desse balde atribuiria o problema justamente ao que representa a rotina normal. Na tela Análise por Setor ele aparece marcado como "(rotina normal)".

### Causas

Distribuição das causas dos casos **fora do padrão** (a causa de um caso normal não descreve um problema). Sem causa registrada entra como **"Não classificada"** em vez de ser omitido: saber quanto do total está sem classificação é parte do diagnóstico.

### Pendências, prazos e revisão

| Indicador | `null` quando |
|---|---|
| Aderência ao prazo | Nenhuma pendência resolvida tinha prazo definido |
| Taxa de aprovação | Nenhuma pendência foi revisada ainda |
| Tempo médio de resolução | Nenhuma pendência foi resolvida ainda |

Nos três casos a tela mostra "—" e a frase que explica o que falta.

### Pontos de atenção

A lista "O que exige atenção agora" não usa nenhum limiar inventado: prazos vencidos usam o prazo que alguém definiu; reincidência usa `recurrenceLimit` do workspace; cadastro incompleto usa a própria ausência de padrão cadastrado; "sem responsável" e "aguardando revisão" são estados factuais. Cada item leva à tela onde se resolve.

## Relatórios e exportação

`src/services/reportService.ts`. Um relatório é uma tabela (colunas + linhas) montada a partir dos **mesmos services que alimentam as telas** — se um número diferir entre a tela e o relatório, é bug, não interpretação alternativa.

Sete relatórios: Pendências, Horas extras, Divergências, Por colaborador, Por setor, Reincidência, Auditoria.

**Escopo:** quem chama passa os dados já filtrados pelo workspace ativo e pelo período. O service nunca lê storage direto, então não há como um relatório vazar dado de outra empresa. As pendências são filtradas pelas mesmas datas do período — sem isso, um relatório "de agosto" traria pendências de julho e o total não bateria com a tela. **Exceção documentada:** o relatório de Auditoria é sempre a trilha inteira da empresa (eventos de auditoria não têm data de dia processado); o escopo impresso no arquivo diz isso explicitamente.

**Formato CSV**, gerado no navegador. Escolhido por ser o único que abre no Excel, Google Sheets e em qualquer ferramenta de BI sem dependência nova — PDF/XLSX exigiriam biblioteca externa e ficam no ROADMAP. Separador `;` (o Excel em português espera isso; com vírgula ele joga a linha inteira numa célula), escape RFC 4180, e BOM UTF-8 (sem ele o Excel no Windows abre acentuação corrompida). Cada arquivo traz cabeçalho com empresa, escopo e data/hora de geração.

Toda exportação é auditada e registrada em `ReportRepository` (histórico do que foi extraído e quando — não reproduz o arquivo).

## Múltiplas empresas — ciclo de vida

`src/services/workspaceService.ts`. Criar e excluir uma empresa toca mais de um storage (configuração, dias do motor, pendências, auditoria); a orquestração mora no service para que "o que compõe uma empresa" não fique espalhado pela interface — um esquecimento aqui significaria dado órfão de uma empresa excluída aparecendo em outra.

**Criar** (Configurações → Empresas): nasce de `novoWorkspace()` — cadastro vazio, regras nos defaults neutros. **Nada é copiado da empresa ativa**; herdar configuração da anterior em silêncio é exatamente o que a portabilidade proíbe. Toda empresa criada pela interface é ambiente `real`: `demo` é reservado ao ambiente de demonstração, cujo seed fictício não deve poder ser disparado sobre uma empresa de verdade.

**Excluir**: apaga configuração, dias processados, pendências e auditoria — as chaves são removidas, não zeradas. Os ids `real` e `demo` são protegidos: excluir um deles deixaria a aplicação sem ambiente base.

**Diagnóstico de prontidão** (`resumirWorkspace`): a lista de empresas mostra o que falta configurar em cada uma (unidade, setor, colaboradores, escala, usuário), para guiar quem está montando uma empresa nova em vez de deixar descobrir só quando um indicador aparece vazio.

**Nomes duplicados são bloqueados** em Unidades e Setores. O que fica gravado num caso é o NOME do setor, não o id — dois homônimos seriam indistinguíveis na hora de classificar uma pendência e na análise. `DepartmentRepository.listNomes()` também deduplica, como defesa para dados cadastrados antes dessa validação existir.

## Ação necessária e situação da revisão

`pendenciaService.acaoNecessaria()` traduz o estado da pendência em "o que fazer agora" (atribuir responsável / investigar / cadastrar padrão / revisar / reabrir / nada a fazer). Fica no service, não na tela, porque é regra de fluxo: o próximo passo depende de como o ciclo foi definido, e essa definição precisa ser a mesma em toda tela que mostrar a fila.

## Onde as regras vivem depois da Fase 3

O backend criado na Fase 3 **não recebeu nenhuma regra de negócio de jornada**. Isso é deliberado:

| Regra | Onde vive | Observação |
|---|---|---|
| Cruzamento ponto × escala × rastreio × padrão | `public/motor-he/index.html` | Intocado. Nenhuma linha foi alterada para acomodar backend |
| Tolerância, HE, jornada, status, prioridade, SLA, score, indicadores | `src/services/` | Continuam sendo a única fonte de verdade |
| Persistência e isolamento entre empresas | `server/` | O servidor guarda e protege o dado; não o interpreta |
| Quem pode fazer o quê | `server/lib/permissoes.js` | Regra de autorização, não de jornada |

**Duplicação consciente:** os valores padrão neutros de `Rules` aparecem em dois lugares — `src/domain/Rules.ts` (frontend) e `server/repositories/tenantRepository.js` (ao criar um tenant). São sete números simples e nenhum dos dois lados pode importar o outro. Se um mudar, o outro precisa mudar junto; está registrado aqui e em [BACKEND.md](BACKEND.md) para que não seja descoberto por acidente.
