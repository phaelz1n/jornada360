# Controle de duplicidades no cadastro de motoristas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidar duplicidades exatas no cadastro e impedir novos registros com o mesmo nome normalizado, sem unir nomes apenas parecidos.

**Architecture:** Criar uma função de domínio para normalizar, agrupar e escolher o registro principal. A tela de cadastro usará essa função para exibir grupos consolidados e alertas de nomes parecidos; o salvamento validará o nome normalizado antes de chamar o Firestore.

**Tech Stack:** JavaScript/React, Node test runner, Firebase Firestore.

**Spec:** `docs/superpowers/specs/2026-11-05-duplicidades-motoristas-design.md`

## Global Constraints

- Fusão automática somente para nomes exatamente iguais após normalização.
- Nomes apenas parecidos nunca serão fundidos automaticamente.
- Históricos e snapshots existentes não serão apagados.
- Horários válidos, setor preenchido e padrão cadastrado devem ser preservados.

## Review Focus

- Acentos, caixa e espaços repetidos devem formar um único grupo.
- Dois nomes parecidos, mas não iguais, devem continuar separados.
- O cadastro mais completo deve vencer registros vazios ou incompletos.
- Salvar um novo nome duplicado deve ser bloqueado antes da escrita.
- Dados operacionais importados sem cadastro não devem criar duplicidade visual.

### Task 1: Domínio de agrupamento

**Files:**
- Create: `src/cadastro/motoristas-duplicates.js`
- Create: `src/cadastro/motoristas-duplicates.test.js`

- [ ] Escrever testes para normalização, agrupamento exato, escolha do registro mais completo e nomes parecidos.
- [ ] Implementar `normalizeDriverKey(name)`, `mergeDuplicateDrivers(drivers, items)` e `findSimilarDriverNames(drivers)`.
- [ ] Executar os testes do novo módulo.

### Task 2: Cadastro e bloqueio de novos duplicados

**Files:**
- Modify: `src/modules/OperationalModules.jsx`
- Modify: `src/lib/firestore-writes.js` se necessário para validar a identidade antes da escrita
- Test: `src/cadastro/motoristas-duplicates.test.js`

- [ ] Usar o agrupamento consolidado na lista de cadastro.
- [ ] Mostrar grupos consolidados e alerta separado para nomes parecidos.
- [ ] Bloquear salvamento quando o nome normalizado já pertence a outro registro.
- [ ] Garantir que edição do próprio registro continue permitida.

### Task 3: Integração dos cálculos e validação

**Files:**
- Modify: `src/processamento/processamento-model.js` somente se necessário para consumir cadastro consolidado
- Add tests in `src/processamento/processamento-model.test.js` if needed

- [ ] Confirmar que relatórios e processamento recebem somente um cadastro por nome normalizado.
- [ ] Confirmar que importações não aumentam a quantidade visual de cadastros duplicados.
- [ ] Rodar toda a suíte, `git diff --check` e `npm run build`.
- [ ] Fazer commit com a alteração consolidada.
