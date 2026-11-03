# Auditoria de horários e evolução do dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auditar e corrigir cálculos de jornada comprovadamente incorretos e adicionar gráficos analíticos ao dashboard do Jornada360.

**Architecture:** Manter o processamento existente, extraindo apenas funções puras de tempo quando necessário. Criar um módulo analítico que transforma o resultado de `consultarDia/consultarPeriodo` em séries e distribuições; `InicioDashboard` apenas coordena filtros e renderiza componentes visuais.

**Tech Stack:** React 18, Vite, JavaScript/JSX, CSS/SVG, Node test runner.

**Spec:** `docs/superpowers/specs/2026-11-03-auditoria-horarios-dashboard-design.md`

## Global Constraints

- Não adicionar biblioteca externa de gráficos nesta etapa.
- Horas negativas do padrão não podem virar extra positiva nem meta positiva.
- A data principal continua vindo do relatório de ponto principal; o relatório anterior serve para interjornada.
- Observações e alterações do checklist não podem ser afetadas.
- Os 84 testes existentes devem continuar passando.
- Validar com `npm test`, `npm run build` e `git diff --check`.

## Review Focus

- Jornada com pares atravessando meia-noite e mais de um intervalo; duração e intervalos devem permanecer não negativos e coerentes.
- Horário padrão em formato `21:25`, `00:30`, `04:10`, `08:00`; comparação não deve tratar `00:30` como distante por 24 horas.
- Padrão negativo e padrão ausente; meta, dentro/acima do padrão e sem padrão não devem se contradizer.
- Itens com buckets explícitos HE.1/HE.2/HE.3 que excedem 120 minutos; não redistribuir dados deliberadamente separados.
- Dashboard vazio ou com apenas um dia; gráficos devem renderizar estado vazio sem `NaN`, overflow ou exceção.

### Task 1: Auditoria matemática de tempo e metas

**Files:**
- Modify: `src/processamento/cruzamento.js`
- Modify: `src/processamento/rastreador-analysis.js` se a auditoria confirmar divergência na normalização de jornada noturna
- Modify: `src/relatorios/relatorio-query.js`
- Test: `src/processamento/cruzamento.test.js`
- Test: `src/processamento/rastreador-analysis.test.js`
- Test: `src/relatorios/relatorio-query.test.js`

**Interfaces:**
- Consumes: `durationFromPairs`, `analyzeIntervals`, `consultarPeriodo` e os campos atuais dos snapshots.
- Produces: comportamento matemático coberto por testes; não alterar o contrato público das consultas.

- [ ] **Step 1: Write failing regression tests** para jornada noturna com pares, comparação de padrão após meia-noite, intervalo obrigatório e padrão negativo.
- [ ] **Step 2: Run focused tests** com `node --test src/processamento/cruzamento.test.js src/processamento/rastreador-analysis.test.js src/relatorios/relatorio-query.test.js`; registrar falhas reais antes da correção.
- [ ] **Step 3: Trace cada falha até a origem** e corrigir somente a função responsável, preservando buckets explícitos e o caso Ademar.
- [ ] **Step 4: Run focused tests again** e confirmar PASS sem alterar regras não cobertas.
- [ ] **Step 5: Commit** com mensagem `fix: harden jornada time calculations`.

### Task 2: Camada analítica para gráficos

**Files:**
- Create: `src/dados/dashboard-analytics.js`
- Create: `src/dados/dashboard-analytics.test.js`
- Modify: `src/relatorios/relatorio-query.js` apenas se for necessário expor dados já calculados, sem duplicar regras.

**Interfaces:**
- Consumes: `report = { items, summary, porMotorista }`, `snapshots`, `competencia`.
- Produces: `buildDashboardAnalytics({ report, snapshots, period })` retornando `{ dailySeries, bucketComposition, driverDistribution, sectorComparison, riskMatrix }`.

- [ ] **Step 1: Write failing tests** para séries diárias, composição HE, ranking, setores, alertas e estado vazio.
- [ ] **Step 2: Run `node --test src/dados/dashboard-analytics.test.js`** e observar FAIL.
- [ ] **Step 3: Implement funções puras** com números finitos, ordenação determinística e sem mutar snapshots.
- [ ] **Step 4: Run analytics tests** e confirmar PASS, incluindo dados de virada de ciclo e ausência de registros.
- [ ] **Step 5: Commit** com mensagem `feat: add dashboard analytics model`.

### Task 3: Componentes visuais do dashboard

**Files:**
- Create: `src/modules/DashboardCharts.jsx`
- Modify: `src/modules/InicioDashboard.jsx`
- Modify: `src/styles.css`
- Test: `src/dados/dashboard-analytics.test.js` para qualquer ajuste de contrato

**Interfaces:**
- Consumes: `buildDashboardAnalytics` e os filtros atuais de `InicioDashboard`.
- Produces: gráficos acessíveis e responsivos de evolução diária, composição por bucket, distribuição por motorista, comparação de setores e matriz de riscos.

- [ ] **Step 1: Implement o renderizador SVG/CSS** com labels textuais, tooltips nativos e estados vazios.
- [ ] **Step 2: Integrar `buildDashboardAnalytics`** ao dashboard sem remover cards, ranking, eventos ou filtros existentes.
- [ ] **Step 3: Adicionar estilos responsivos e modo escuro** seguindo as classes executivas atuais.
- [ ] **Step 4: Run `npm test`** e confirmar que a integração não quebrou os testes.
- [ ] **Step 5: Commit** com mensagem `feat: expand executive dashboard charts`.

### Task 4: Verificação final

**Files:**
- Modify: qualquer arquivo somente se a verificação encontrar falha comprovada.

- [ ] **Step 1: Run `npm test`**; esperado: todos os testes aprovados.
- [ ] **Step 2: Run `npm run build`**; esperado: build Vite concluído sem erro.
- [ ] **Step 3: Run `git diff --check`**; esperado: nenhuma saída.
- [ ] **Step 4: Revisar o diff** procurando mutações de snapshot, `NaN`, cálculos duplicados e regressões de filtros.
- [ ] **Step 5: Registrar resultado final** e não fazer push sem solicitação explícita.
