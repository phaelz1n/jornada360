# Onboarding de uma empresa nova

Como o Jornada360 recebe um cliente que acabou de criar sua empresa — e por que foi feito assim.

---

## O problema que isso resolve

Antes desta versão, o sistema criava sozinho um workspace chamado "Minha Empresa" e já colocava o visitante dentro dele. Três consequências ruins:

1. Quem abria o produto entrava numa empresa que não criou, com um nome que não é dele.
2. Não ficava claro se aquilo era demonstração ou produção.
3. Um Dashboard zerado parecia uma operação impecável, e não uma empresa vazia.

O portão de entrada e o painel de configuração existem para resolver exatamente esses três pontos.

---

## O portão de entrada

Quando não há empresa ativa, a aplicação mostra `src/pages/BemVindo.tsx` com três caminhos explícitos:

| Opção | Resultado |
|---|---|
| **Criar minha empresa** | Pede o nome, cria um workspace vazio e entra nele |
| **Ver demonstração** | Entra no ambiente fictício, marcado em roxo |
| **Já tenho acesso** | Login com e-mail e senha |

> **Fase 4:** o login passou a existir de verdade, ponta a ponta. Criar empresa agora cria **conta + empresa + vínculo de administrador** numa transação só, no servidor. A demonstração continua sendo local e sem conta — é o que permite abri-la em qualquer máquina, inclusive com o servidor desligado. Ver [AUTH.md](AUTH.md).

Se já houver empresas configuradas naquele navegador, elas aparecem numa lista abaixo — mas **um visitante novo não vê lista nenhuma**, e ninguém entra numa empresa por acidente.

**Como isso funciona por dentro:** `WorkspaceRepository.ensureBootstrap()` garante apenas o workspace de demonstração e devolve `activeId: null`. `App.tsx` então renderiza as rotas públicas em vez do shell da aplicação. Quem já usava o sistema tem um `activeWorkspaceId` salvo e entra direto onde estava, sem ver o portão.

---

## O que uma empresa nova recebe

```
Cadastro:        vazio (0 unidades, 0 setores, 0 colaboradores, 0 escalas)
Usuários:        1 administrador padrão
Causas:          lista genérica editável
Regras:          valores padrão neutros
Dados de ponto:  nenhum
Pendências:      nenhuma
Auditoria:       vazia
Ambiente:        real (nunca 'demo')
```

**Nada é copiado da demonstração nem de outra empresa.** Isso é garantido em três camadas:

1. `WorkspaceRepository.criar()` monta o workspace a partir de `novoWorkspace()` — nunca a partir do workspace ativo.
2. Empresas criadas pela interface são sempre de ambiente `real`.
3. `seedDemoWorkspaceIfEmpty()` verifica `environment !== 'demo'` e **recusa** rodar em qualquer outro ambiente.

---

## O painel de configuração

Aparece no Dashboard enquanto a empresa não estiver pronta para operar. Nove passos:

| # | Passo | Essencial | Por quê |
|---|---|---|---|
| 1 | Empresa | Sim | Nome que aparece no sistema e nos relatórios |
| 2 | Unidades | Não | Permite comparar filiais; operação única pode pular |
| 3 | Setores | Sim | Opções ao classificar uma pendência |
| 4 | Escalas | Sim | **Sem horário padrão nenhuma jornada pode ser julgada** |
| 5 | Colaboradores | Sim | Liga registros a setor e unidade nos indicadores |
| 6 | Regras | Não | Já nascem com valores razoáveis; só a meta nasce zerada |
| 7 | Integrações | Não | Importação por arquivo já funciona |
| 8 | Usuários | Não | Viram opções de responsável |
| 9 | Primeiros dados | Sim | É o que liga o sistema |

O painel mostra barra de progresso, percentual, e destaca o **próximo passo** — o primeiro essencial pendente — com o motivo escrito e um botão que abre a aba certa (`/configuracoes?aba=setores`).

### O progresso é derivado, não salvo

Não existe flag "onboarding concluído". `onboardingService.calcularProgresso()` recalcula tudo a partir do cadastro real a cada leitura. Duas razões:

- Um flag mentiria: apagar a última escala deixaria o sistema dizendo "pronto" com a empresa quebrada.
- Quem configurou por fora, direto nas abas, aparece corretamente como concluído sem refazer nada.

O painel some sozinho quando todos os passos essenciais estão prontos.

### Nada é obrigatório

O roteiro orienta, não bloqueia. Todas as telas ficam acessíveis desde o primeiro segundo. A pessoa pode parar no meio, sair, voltar dias depois — o progresso é recalculado e continua de onde o cadastro dela realmente está.

---

## Estados vazios: "sem dados" ≠ "sem problemas"

Esta é a distinção mais importante da experiência de um cliente novo.

"0 pendências" pode significar duas coisas opostas: a operação está impecável, ou nada foi analisado ainda. Mostrar o mesmo zero nos dois casos faz uma empresa vazia parecer perfeita — a pior leitura possível para quem acabou de criar a conta.

| Situação | O que a tela mostra |
|---|---|
| Nenhum dia processado | "Seu ambiente ainda não possui dados", com os caminhos: processar / configurar / importar |
| Dias processados, nenhuma ocorrência | "Operação sem pendências no período — N dia(s) analisado(s)" |
| Existem casos, mas o filtro escondeu | "Nada em aberto com estes filtros" |

Implementado por `AmbienteSemDados` em `src/components/ui/Indicadores.tsx`, aplicado em Dashboard, Controle de Ponto, Horas Extras, Ranking, Score, Análise por Setor, Relatórios, Pendências e Centro de Ações.

---

## Sair de uma empresa

O botão no canto superior direito volta ao portão. **Não apaga nada** — apenas desfaz a escolha de empresa, permitindo criar outra ou entrar na demonstração. Excluir a empresa ativa também leva ao portão, em vez de cair silenciosamente em outra empresa (o que poderia jogar alguém dentro da demonstração sem perceber).
