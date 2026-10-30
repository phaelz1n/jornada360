# Evidência de rastreador no checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Mostrar no checklist a relação entre padrão, extra, escala e rastreador, com cartão compacto expansível e alerta de padrão possivelmente incorreto.

**Architecture:** O processamento produzirá um resumo por motorista e uma lista de evidências por trecho. O checklist apenas renderizará esses dados e manterá as observações existentes separadas do cálculo refeito na reimportação.

**Tech Stack:** React, JavaScript nativo, Node test runner, Firestore existente.

**Spec:** `docs/superpowers/specs/2026-10-30-checklist-evidencia-rastreador-design.md`

## Global Constraints

- Preservar as regras atuais de cálculo de HE, escala e importação.
- Não apagar observações do checklist ao reprocessar um dia.
- Não alterar automaticamente o padrão cadastrado.

## Review Focus

- Extra parcialmente dentro e parcialmente fora do padrão: testar divisão sem duplicar minutos.
- Fora do padrão com rastreador próximo: testar estado verde/amarelo conforme confiança.
- Fora do padrão sem rastreador: testar estado vermelho e explicação.
- Cinco dias consistentes e sexto divergente: testar alerta de possível padrão incorreto.
- Reimportação: testar preservação das observações junto do novo cálculo.

### Task 1: Modelo de evidência por motorista

**Files:**
- Modify: `src/processamento/cruzamento.js`
- Modify: `src/processamento/processamento-model.js`
- Test: `src/processamento/cruzamento.test.js`

- [ ] Escrever testes para resumo de dentro/fora, evidências de rastreador e alerta após cinco dias consistentes.
- [ ] Rodar os testes e confirmar falha pela ausência dos campos.
- [ ] Implementar campos `evidenciaRastreador`, `rastreadorStatus`, `diferencaMin`, `padraoSuspeito` e `historicoPadrao`.
- [ ] Rodar os testes de processamento e toda a suíte.
- [ ] Fazer commit da camada de dados.

### Task 2: Cartão compacto expansível

**Files:**
- Modify: `src/checklist/ChecklistPanel.jsx`
- Modify: `src/styles.css`
- Test: `src/checklist/checklist-adapter.test.js`

- [ ] Escrever testes para os estados visualizáveis `ok`, `atencao`, `problema` e `padrao-suspeito`.
- [ ] Rodar os testes e confirmar falha.
- [ ] Implementar resumo fechado e detalhes abertos ao clicar.
- [ ] Adicionar cores, ícones/textos e lista de evidências por horário.
- [ ] Rodar toda a suíte e verificar o build.
- [ ] Fazer commit da interface.

### Task 3: Persistência e atualização

**Files:**
- Modify: `src/lib/firestore-store.js`
- Modify: `src/components/AppShell.jsx`
- Test: `src/lib/firestore-store.test.js` ou teste de integração existente

- [ ] Testar reimportação sem perda de observações.
- [ ] Implementar gravação dos campos calculados e atualização dos assinantes do dia.
- [ ] Rodar testes e validar atualização do checklist e dashboard.
- [ ] Fazer commit final e revisão do diff.
