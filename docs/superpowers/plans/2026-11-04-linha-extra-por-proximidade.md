# Detecção de linha extra por proximidade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Identificar no checklist uma linha adicional da escala realizada pelo motorista e exibir corretamente a HE calculada.

**Architecture:** O cruzamento existente em `cruzamento.js` continuará calculando a jornada. A detecção usará linhas fora do horário padrão e associará o horário da escala a uma batida ou parada próxima; o adaptador apenas transportará os campos necessários para a UI.

**Tech Stack:** JavaScript ES modules, React, Node test runner, npm.

**Spec:** `docs/superpowers/specs/2026-11-04-linha-extra-por-proximidade-design.md`

## Global Constraints

- Não alterar o cálculo oficial da jornada ou das horas extras.
- Não confirmar automaticamente a justificativa do motorista.
- Preservar a tolerância de até 30 minutos para associação por horário.
- Não adicionar `firebase-debug.log` ou `tmp/` ao controle de versão.

## Review Focus

- Linha extra na escala com batida próxima, mas sem `HE` positiva no ponto: deve aparecer como candidata.
- Linha extra na escala com parada do rastreador próxima: deve continuar sendo confirmada pelo rastreador.
- Linha da escala sem batida/parada próxima: não deve ser chamada de linha realizada.
- O cartão do checklist deve mostrar o `totalHE` calculado, não zero por campo ausente no adaptador.

### Task 1: Detectar linha extra por proximidade

**Files:**
- Modify: `src/processamento/cruzamento.js`
- Test: `src/processamento/cruzamento.test.js`

**Interfaces:**
- Consumes: `pointRows`, `scaleRows`, `standardRows` e `trackerRows` de `crossSources`.
- Produces: `linhaExtraCandidata`, `linhaExtraDetalhe`, `extraAuditoriaStatus` e `justificativaSugerida` no item cruzado.

- [ ] **Step 1: Write the failing test**

Adicionar um teste com motorista Anderson, padrão `05:35, 07:50, 12:40, 18:30`, batidas `05:38, 08:41, 12:38, 18:20`, extra padrão de 45 minutos e uma linha adicional da escala em horário próximo de `08:41`, sem `totalHE` informado no ponto. Verificar que `linhaExtraCandidata` é `true`, que o detalhe contém o nome da linha e que o item fica com auditoria pendente.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/processamento/cruzamento.test.js`

Expected: the new Anderson assertion fails because the current candidate logic requires a positive reported extra and only looks for a tracker-confirmed line.

- [ ] **Step 3: Implement the minimal proximity evidence**

Em `src/processamento/cruzamento.js`, reutilizar `extraScaleRows` e considerar como evidência uma batida ou parada do rastreador a até 30 minutos do horário da linha. Manter a confirmação por rastreador quando houver parada compatível; quando houver apenas batida, classificar como possível linha extra e gerar o detalhe/justificativa com o horário e a linha.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/processamento/cruzamento.test.js`

Expected: all tests in the file pass, including o caso do Anderson.

### Task 2: Repassar HE calculada ao checklist

**Files:**
- Modify: `src/checklist/checklist-adapter.js`
- Test: `src/checklist/checklist-adapter.test.js`

**Interfaces:**
- Consumes: `totalHE` produzido pelo cruzamento.
- Produces: `totalHE` no item retornado por `snapshotItemsToChecklist`, usado pela `ChecklistPanel`.

- [ ] **Step 1: Write the failing test**

Adicionar um teste que adapte um item com `totalHE: 40` e verifique que o item do checklist mantém `totalHE === 40`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/checklist/checklist-adapter.test.js`

Expected: fail because `totalHE` atualmente não existe no objeto adaptado.

- [ ] **Step 3: Implement the minimal field propagation**

Adicionar `totalHE` ao objeto retornado pelo adaptador, normalizando o valor com a mesma conversão de minutos já usada para as horas extras.

- [ ] **Step 4: Run the full verification suite**

Run: `npm test -- --runInBand`

Expected: all project tests pass.

- [ ] **Step 5: Review the diff**

Run: `git diff --check` e `git status --short`.

Expected: nenhum erro de whitespace e somente os arquivos da especificação, plano, processamento, adaptador e testes aparecem como alterados; `firebase-debug.log` e `tmp/` permanecem fora do escopo.
