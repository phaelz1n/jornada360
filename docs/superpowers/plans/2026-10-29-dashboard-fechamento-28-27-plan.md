# Dashboard de Fechamento 28–27 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Adicionar à dashboard React os resumos por dia e por competência 28–27, sincronizados em tempo real com o Firestore, com filtros, HE.1/HE.2/HE.3, feriado/DSR, interjornada, intrajornada e detalhamento de comparação por motorista.

**Architecture:** Criar primeiro um utilitário puro de competência e uma camada pura de consulta/agregação sobre snapshots processados. Integrar esses resultados ao módulo de relatórios existente, mantendo importação, Firebase e regras de cruzamento sem duplicação. A persistência diária será idempotente e a leitura usará `onSnapshot` para refletir novas importações sem recarregar a página.

**Tech Stack:** React 18, JavaScript ES modules, Vite, Firebase/Firestore, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-29-dashboard-fechamento-28-27-design.md`

## Global Constraints

- A competência é sempre `[28/(M-1), 27/M]`.
- Datas devem ser comparadas por chave local `YYYY-MM-DD`, sem deslocamento de fuso.
- HE.3 inclui feriado/DSR identificado no ponto e excedente acima de HE.1 + HE.2.
- Cadastro de setor tem precedência sobre `Sem setor`.
- Ausência de escala ou rastreador permanece visível.
- Importação nova atualiza o dia correspondente sem apagar outros dias.
- Importação do mesmo dia substitui somente o snapshot daquele dia.
- Dashboard e checklist reagem ao `onSnapshot` sem F5.
- Comparação exibe divergência, confirmação de batidas, janela do rastreador, horário padrão, padrão cadastrado e justificativa.

## Review Focus

- Datas 27/28 na virada de competência: teste de limite da competência.
- Fevereiro e virada de ano: teste de calendário real.
- Linha marcada feriado/DSR com menos de quatro horas: teste de HE.3.
- Registros com HE.1 informado e HE.2/HE.3 ausentes: teste da divisão do excedente.
- Filtros que deixam zero registros: teste de estado vazio e totais zerados.

---

### Task 1: Utilitário de competência 28–27

**Files:**
- Create: `src/relatorios/competencia.js`
- Test: `src/relatorios/competencia.test.js`

**Interfaces:**
- Produces `competenciaParaData(dateKey) -> { inicio, fim, chave, rotulo }`.
- Produces `listarDatas(inicio, fim) -> string[]`.

- [ ] **Step 1: Write failing tests** para 27/10 → 28/09–27/10, 28/10 → 28/10–27/11, fevereiro e virada de ano.
- [ ] **Step 2: Run** `node --test src/relatorios/competencia.test.js` e confirmar falha inicial.
- [ ] **Step 3: Implement** as funções usando chaves ISO de calendário e sem `toISOString()` sobre datas locais.
- [ ] **Step 4: Run** o teste novamente e confirmar aprovação.
- [ ] **Step 5: Commit** `feat: add 28-27 closing period utility`.

### Task 2: Agregação diária e por período

**Files:**
- Create: `src/relatorios/relatorio-query.js`
- Test: `src/relatorios/relatorio-query.test.js`
- Modify: `src/processamento/processamento-model.js` apenas se for necessário expor a classificação de feriado/DSR sem duplicá-la.

**Interfaces:**
- `consultarDia(snapshots, dateKey, filtros) -> ReportResult`.
- `consultarPeriodo(snapshots, competencia, filtros) -> ReportResult`.
- `ReportResult` contém `items`, `summary`, `porMotorista`, `porSetor` e `diasProcessados`.

- [ ] **Step 1: Write failing tests** para soma de HE.1/HE.2/HE.3, colaboradores distintos, setores e ocorrências inter/intra.
- [ ] **Step 2: Add tests** para feriado/DSR virar HE.3 mesmo abaixo de quatro horas.
- [ ] **Step 3: Run** os testes e confirmar falha.
- [ ] **Step 4: Implement** a consulta diária e o agrupamento da competência sem duplicar colaboradores.
- [ ] **Step 5: Implement** a precedência de setor cadastrado e a preservação de status de cruzamento incompleto.
- [ ] **Step 6: Run** os testes da camada e os testes existentes de processamento.
- [ ] **Step 7: Commit** `feat: aggregate daily and closing-period reports`.

### Task 3: Modelo de filtros e estado da dashboard

**Files:**
- Create: `src/relatorios/relatorio-state.js`
- Test: `src/relatorios/relatorio-state.test.js`

**Interfaces:**
- `createInitialReportState(data) -> state`.
- `updateReportFilter(state, patch) -> state`.
- `selectReport(state) -> ReportResult`.

- [ ] **Step 1: Write failing tests** para alternância diário/período, data, competência, motorista, setor e categoria.
- [ ] **Step 2: Run** os testes e confirmar falha.
- [ ] **Step 3: Implement** estado puro, mantendo filtros independentes do snapshot.
- [ ] **Step 4: Testar** estado vazio e retorno à opção “Todos”.
- [ ] **Step 5: Commit** `feat: add report filter state`.

### Task 4: Interface de relatórios

**Files:**
- Modify: `src/modules/OperationalModules.jsx`
- Modify: `src/components/AppShell.jsx`
- Modify: `src/styles.css`
- Test: `src/modules/OperationalModules.test.jsx` ou teste de modelo equivalente existente.

**Interfaces:**
- O módulo de relatórios consome `dashboardData` e renderiza os controles definidos no estado da Task 3.
- Cada motorista pode expandir seu resumo diário dentro do relatório, sem navegar para o checklist.

- [ ] **Step 1: Add failing component/model tests** para os rótulos “Por dia”, “Por período”, “HE.1”, “HE.2”, “HE.3”, “Feriado/DSR” e filtros.
- [ ] **Step 2: Implement** seletor de modo, seletor de data/competência e filtros.
- [ ] **Step 3: Implement** cartões de totais, tabela por motorista/setor e detalhe expansível.
- [ ] **Step 4: Implement** estados vazios e fontes ausentes sem quebrar o restante do painel.
- [ ] **Step 5: Run** testes de interface e conferir responsividade no navegador.
- [ ] **Step 6: Commit** `feat: add daily and closing-period dashboard`.

### Task 5: Persistência, importação e validação final

**Files:**
- Modify: `src/dados/dashboard-data.js`
- Modify: `src/lib/firestore-store.js` e `src/lib/firestore-writes.js` para upsert diário e assinatura `onSnapshot`.
- Modify: `src/importacao/ImportacaoPanel.jsx` se necessário.
- Tests: testes de importação, Firebase mockado e build.

**Interfaces:**
- Dashboard consulta snapshots remotos primeiro e fallback local depois.
- Uma importação nova substitui apenas o registro do mesmo dia.

- [ ] **Step 1: Add test** para uma nova planilha atualizar um dia sem apagar os demais.
- [ ] **Step 2: Add test** para novo snapshot disparar atualização dos consumidores via assinatura.
- [ ] **Step 3: Implement** upsert diário e assinatura em tempo real; manter leitura dos snapshots para alimentar a consulta por período.
- [ ] **Step 4: Add test** do objeto de comparação com divergência forte, batidas não confirmadas, rastreador incompleto e janela coberta.
- [ ] **Step 5: Implement** a exibição do detalhe de comparação no checklist e no detalhe do relatório.
- [ ] **Step 6: Run** todos os testes com `npm test`.
- [ ] **Step 7: Run** `npm run build`.
- [ ] **Step 8: Testar** o fluxo publicado com login, importação, relatório diário, período 28–27 e atualização sem F5.
- [ ] **Step 9: Commit** `test: validate daily and closing-period dashboard`.

## Verificação final

- `npm test` sem falhas.
- `npm run build` concluído.
- Competências de limite conferidas visualmente.
- HE.3 de feriado/DSR conferida em um caso real de planilha.
- Filtros não alteram dados fora do recorte selecionado.
