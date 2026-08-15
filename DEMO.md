# Ambiente de demonstração

## Por quê

Pra apresentar o Jornada360 (numa entrevista, para um cliente em potencial) sem expor nenhum dado real de operação ou de colaborador.

## O que tem

Workspace `demo` ("Jornada360 Demo"), criado automaticamente na primeira vez que o sistema roda, com:

- 5 colaboradores fictícios: **João da Silva, Carlos Oliveira, Marcos Santos, Ana Ferreira, Juliana Costa**.
- 12 dias de dados fictícios de ponto, HE, divergências, pendências (abertas e já resolvidas com justificativa) e setores (Operacional, Trânsito, Garagem, Administrativo).
- Gerado por `src/demo/seedDemo.ts`, com uma seed determinística (`mulberry32`) — os mesmos números aparecem toda vez que o ambiente é recriado do zero, o que ajuda a demonstrar de forma consistente.

Importante: os dados fictícios são gerados **exatamente no mesmo formato** que o motor real produz (`HEDiaSnapshot`/`HECaseState`) — por isso todas as telas (Dashboard, Pendências, Controle de Ponto, Ranking, Score, Análise por Setor, Relatório) funcionam com o Demo sem nenhum código condicional. O Demo não é uma versão simplificada da interface; é dado fictício passando pelo caminho real.

## Como entrar

Pelo **portão de entrada**, na opção **Ver demonstração** — é uma escolha explícita, nunca um destino automático. Se já houver uma empresa ativa, o seletor no topo permite alternar; empresas reais aparecem com 🟢 e a demonstração com 🟣.

Enquanto o ambiente de demonstração estiver ativo, aparece um aviso roxo bem visível ("🟣 AMBIENTE DEMONSTRAÇÃO — dados fictícios") — impossível confundir com dado real, inclusive em captura de tela.

**A demonstração nunca é um destino silencioso.** Nem no primeiro acesso (que leva ao portão), nem ao excluir a empresa ativa (que também leva ao portão em vez de cair em outro ambiente).

## Os dados fictícios nunca saem da demonstração

Quatro garantias, em camadas independentes:

1. **Trava por ambiente** — `seedDemoWorkspaceIfEmpty()` verifica `workspace.environment === 'demo'` e recusa qualquer outro. Não basta o id ser `demo`: nem uma chamada equivocada consegue semear dados fictícios numa empresa real.
2. **Empresas novas nascem como ambiente `real`** — `WorkspaceRepository.criar()` sempre define `'real'`, então nenhuma empresa criada pela interface passa pela verificação acima.
3. **Namespace separado** — os dias processados da demonstração vivem em `assistente_he_local_demo_...`; nenhuma outra empresa lê essa chave.
4. **Nem o cadastro vaza** — trocar para uma empresa real não mostra usuários, setores ou colaboradores da demonstração. Verificado ao vivo: no ambiente real, a lista de responsáveis não oferece nenhum usuário criado ali.

O seed também nunca copia de outro workspace: gera tudo a partir de uma semente determinística própria (`mulberry32`).

## O que dá pra demonstrar com ele

O Demo tem dados suficientes para mostrar o ciclo inteiro numa apresentação: Dashboard Executivo com indicadores reais calculados, evolução temporal, rankings, principais causas, score multidimensional de 5 colaboradores, fila do Centro de Ações com pendências abertas e resolvidas, explicabilidade de cada caso, e os 7 relatórios exportáveis em CSV.

O que ele **não** tem por padrão: unidades e colaboradores cadastrados. Isso é proposital — deixa visível o aviso "X registros não puderam ser ligados a uma unidade porque o colaborador não está no cadastro", que é justamente a mensagem honesta que o sistema dá quando o cadastro está incompleto. Se quiser demonstrar o recorte por unidade, cadastre unidades e colaboradores no Demo com os 5 nomes fictícios.

## Isolamento

Real e Demo nunca se misturam — cada um vive num namespace de `localStorage` completamente separado (`assistente_he_local_real_...` vs. `assistente_he_local_demo_...`, e `jornada360:real:...` vs. `jornada360:demo:...`). Editar regras, colaboradores ou processar um dia no Demo não afeta o workspace Real, e vice-versa. Ver [ARCHITECTURE.md](ARCHITECTURE.md#isolamento-por-workspace).

## Resetar o Demo

Dashboard (dentro do workspace Demo) → card "Operação Real — Assistente HE Diário" → botão **"Limpar histórico"**. Isso apaga os dias processados nesse workspace; na próxima vez que a aplicação carregar, `seedDemoWorkspaceIfEmpty()` detecta que o workspace está vazio e recria o dataset fictício automaticamente.
