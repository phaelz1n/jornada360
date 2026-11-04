# Melhoria do Modo Escuro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar uma paleta escura consistente e confortável a todas as áreas do Jornada360 sem alterar o layout ou o comportamento.

**Architecture:** Centralizar a paleta em variáveis CSS sob `.theme-dark` e adicionar regras de acabamento para superfícies, textos, campos, tabelas, status e componentes de dados. A implementação ficará em `src/styles.css`, seguindo o mecanismo de tema existente.

**Tech Stack:** CSS, React/Vite existente, Node test runner.

**Spec:** Definição aprovada na conversa: fundo `#080F1A`, superfícies `#0C1830`/`#162438`/`#20324A`, bordas `#30445F`, texto `#E3EDF9`, secundário `#A8B9CC`, ação `#3A78C2`, sucesso `#39C59A`, alerta `#E2A84B`, erro `#E56B61`.

## Global Constraints

- Manter o layout atual.
- Aplicar o tema a login, navegação, dashboard, importação, checklist, relatórios, férias, acessos, tabelas, formulários, filtros, alertas e calendários.
- Evitar preto puro e preservar contraste entre texto principal e secundário.
- Não alterar lógica de negócio ou persistência.

## Review Focus

- Componentes sem uma regra `.theme-dark` específica devem herdar as variáveis globais.
- Campos nativos, selects e tabelas não podem voltar a fundo branco.
- Estados de sucesso, alerta e erro devem continuar distinguíveis no fundo escuro.
- Cartões e superfícies elevadas precisam manter hierarquia sem bordas brilhantes.

### Task 1: Aplicar a paleta escura global

**Files:**
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: classe `.theme-dark` já aplicada pelo shell do sistema.
- Produces: tokens e overrides visuais para todos os componentes existentes.

- [ ] **Step 1: Adicionar tokens de tema e regras de base**

Criar variáveis de fundo, superfície, borda, texto, ação e estados sob `.theme-dark`, além de ajustar `body`, `.shell`, `.shell-content`, `.sidebar`, `.topbar`, `.user-chip` e menus.

- [ ] **Step 2: Cobrir superfícies e conteúdo operacional**

Aplicar as variáveis aos cartões, painéis, tabelas, formulários, inputs, selects, botões secundários, calendários, listas e áreas de importação.

- [ ] **Step 3: Cobrir estados semânticos e gráficos**

Ajustar alertas, badges, checklist, evidências, indicadores do dashboard, barras, gráficos e mensagens de sucesso/erro para manter contraste e significado.

- [ ] **Step 4: Verificar a suíte existente**

Run: `npm test -- --runInBand`

Expected: todos os testes existentes passam, pois a mudança é exclusivamente visual.

- [ ] **Step 5: Conferir o diff**

Run: `git diff --check` e `git status --short`.

Expected: nenhuma falha de whitespace e somente os arquivos do tema/plano aparecem como modificados; `firebase-debug.log` e `tmp/` permanecem fora do commit.
