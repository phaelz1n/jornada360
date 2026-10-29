# Painel Jornada360 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Substituir o painel antigo por módulos React/Tailwind que consumam um snapshot único e preservem as regras operacionais.

**Architecture:** Normalizadores e regras puras formam o núcleo; Firebase fica nos adaptadores de persistência; React apenas orquestra telas e estado. O HTML legado deixa de ser rota operacional.

**Tech Stack:** React, Vite, Tailwind, Firebase Firestore/Auth, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-29-painel-jornada360-design.md`

## Global Constraints

- O painel antigo será substituído totalmente.
- A lógica ponto × escala × rastreador deve produzir resultado equivalente.
- HE.1 usa até 120 minutos; HE.2 recebe o excedente até 240; HE.3 recebe o restante.
- Checklist e relatórios devem consumir o mesmo snapshot processado.

## Review Focus

- Nomes abreviados entre fontes: testar correspondência única e ambígua em `cruzamento.test.js`.
- Planilhas com cabeçalhos alternativos: testar em `planilha-normalizer.test.js`.
- Faixas de 2h, 2h30, 4h e 4h30: testar em `processamento-model.test.js`.
- Reprocessamento do mesmo dia: testar em `firestore-migration.test.js`.
- Estado do checklist por dia: testar em `checklist-adapter.test.js`.

### Task 1: Núcleo canônico e regras de equivalência

**Files:**
- Modify: `src/processamento/processamento-model.js`
- Modify: `src/processamento/planilha-normalizer.js`
- Modify: `src/processamento/cruzamento.js`
- Test: arquivos de teste correspondentes

- [ ] Escrever casos RED para faixas HE e cruzamento completo.
- [ ] Implementar um resultado canônico por motorista/dia.
- [ ] Fazer `prepareProcessedDay` ser a única entrada para o snapshot.
- [ ] Rodar testes do núcleo.

### Task 2: Importação e persistência do snapshot

**Files:**
- Modify: `src/components/AppShell.jsx`
- Modify: `src/importacao/ImportacaoPanel.jsx`
- Modify: `src/lib/firestore-writes.js`
- Test: `src/lib/firestore-migration.test.js`

- [ ] Testar reprocessamento idempotente.
- [ ] Persistir fontes, snapshot e data processada com a mesma chave de dia.
- [ ] Atualizar a tela após importação sem recarregar a aplicação.

### Task 3: Checklist operacional

**Files:**
- Modify: `src/checklist/ChecklistPanel.jsx`
- Modify: `src/checklist/checklist-adapter.js`
- Test: `src/checklist/checklist-adapter.test.js`

- [ ] Testar carregamento do snapshot e validação individual/em massa.
- [ ] Exibir HE.1/HE.2/HE.3, causa, setor e correção no mesmo caso.
- [ ] Salvar o estado por motorista e por data.

### Task 4: Relatórios e cadastros

**Files:**
- Modify: `src/modules/OperationalModules.jsx`
- Modify: `src/components/sections.js`
- Test: novos testes de filtros e totais

- [ ] Testar filtros por período, setor, categoria e motorista.
- [ ] Exibir totais diários e por período de HE.1/HE.2/HE.3, inter e intra.
- [ ] Garantir que cadastros atualizem setores usados no processamento seguinte.

### Task 5: Substituição visual e verificação de produção

**Files:**
- Modify: `src/components/AppShell.jsx`
- Modify: `src/styles.css`
- Modify: `index.html`
- Delete/retire da rota: referência operacional ao legado

- [ ] Finalizar navegação, estados vazios, erros e carregamento.
- [ ] Remover o link operacional do HTML antigo.
- [ ] Rodar suíte completa e build de produção.
- [ ] Verificar deploy READY no Vercel.

