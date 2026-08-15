# Configurar o Jornada360 para uma empresa nova

Nenhum passo abaixo exige tocar em código. Tudo é feito pela interface, em **Configurações**.

## 1. Criar a empresa

Ao abrir o Jornada360 pela primeira vez, você vê o portão de entrada com três opções. Clique em **Criar minha empresa**, informe o nome e confirme.

A empresa nasce com o cadastro totalmente vazio e as regras nos valores padrão. **Ela nunca herda nada** — nem da demonstração, nem de outra empresa: nem colaboradores, nem setores, nem tolerância, nem meta. O sistema já entra nela automaticamente e mostra o roteiro de configuração.

Depois, para criar mais empresas, vá em **Configurações → Empresas**. Essa aba mostra, para cada uma, o que ainda falta configurar — use como checklist.

O ambiente de **Demonstração** não pode ser excluído (é a cópia de apresentação do sistema); qualquer empresa que você criar, sim. A exclusão apaga cadastro, dias processados, pendências e auditoria daquela empresa, e pede confirmação.

Confirme no seletor do topo que você está na empresa certa antes de configurar — tudo que você fizer daqui pra frente vale só para ela. O botão ao lado do seletor sai da empresa e volta ao portão, sem apagar nada.

### Siga o roteiro

O Dashboard mostra um painel de **Configuração da sua empresa** com nove passos e uma barra de progresso, destacando sempre o próximo passo e o motivo dele existir. Os passos marcados como **essenciais** são o mínimo para o sistema conseguir analisar uma jornada.

Você não precisa preencher tudo de uma vez: o progresso é recalculado a partir do que está cadastrado, então dá para parar e continuar depois. O painel desaparece sozinho quando o essencial estiver pronto. Ver [ONBOARDING.md](ONBOARDING.md).

## 2. Empresa

**Configurações → Empresa**: nome, CNPJ, identificação interna (opcional), logo (opcional), status. Isso é o que aparece na barra lateral e no topo do sistema.

## 3. Unidades

**Configurações → Unidades**: cadastre cada unidade/filial (nome, código, localização), se a empresa tiver mais de uma. Se for uma operação única, pode pular esta etapa.

## 4. Setores

**Configurações → Setores**: cadastre os setores responsáveis (ex.: Operacional, Trânsito, Garagem, Administrativo), vinculando a uma unidade e a um responsável. Esses nomes já aparecem automaticamente como opção ao atribuir setor numa pendência — não precisa configurar em dois lugares.

## 5. Escalas

**Configurações → Escalas**: cadastre os turnos padrão (nome, entrada, saída, dias trabalhados, HE programada). Entrada/saída nascem em branco de propósito — não existe um horário "padrão" genérico que sirva pra qualquer operação, defina o turno real desta empresa. Um colaborador pode ser vinculado a uma dessas escalas no cadastro dele.

## 6. Colaboradores

**Configurações → Colaboradores**: cadastre nome, matrícula, cargo, setor, unidade, status e escala de cada colaborador. Este é o diretório de referência do workspace — **não precisa bater nome a nome com o espelho de ponto** para o motor de HE funcionar (o cruzamento diário usa correspondência aproximada de nomes direto da planilha, independente deste cadastro).

## 7. Regras

**Configurações → Regras** — a parte que realmente muda o comportamento do sistema:

- **Tolerância (minutos)** — diferença até esse valor é considerada normal. Nasce em 10min (default genérico razoável pra qualquer operação).
- **Meta diária de HE1 (minutos)** — usada nos indicadores "dias acima da meta". Nasce em **0 (não configurada)** — o Jornada360 nunca assume a meta de outra empresa; defina o valor real desta operação aqui antes de usar esse indicador.
- **Limite de reincidência** — quantos dias acima do padrão, num período, sinalizam um colaborador como reincidente crítico.
- **Intervalo mínimo / Interjornada mínima** — preparados para configuração futura (ver [BUSINESS_RULES.md](BUSINESS_RULES.md) — hoje o motor ainda usa um valor fixo internamente pra interjornada, 11h/CLT).
- **Prazo padrão para tratar uma pendência (dias)** — nasce em 3 (ponto de partida genérico, não o SLA de nenhuma empresa). Usado **só como sugestão**: na ficha da pendência existe um botão "Sugerir prazo padrão", que calcula `data de criação + N dias`. O sistema nunca define prazo sozinho — quem trata o caso decide.
- **Alerta de prazo próximo (dias de antecedência)** — nasce em 1. Quantos dias antes do vencimento uma pendência aberta passa a aparecer como "Prazo próximo" (em vez de "Dentro do prazo") no Centro de Ações e na ficha.
- **Causas prováveis de divergência** — lista de categorias (ex.: "Autorizado antecipadamente") editável nesta mesma tela; aparece ao classificar uma pendência, aqui e dentro do Assistente HE Diário.

Salvar aqui reclassifica **na hora** todos os casos já processados neste workspace.

## 8. Integrações

**Configurações → Integrações**: confira quais fontes de dados a empresa usa. Hoje só "Importação Excel/CSV" funciona de verdade; Cobli, sistema de ponto e API genérica ficam como "não configurado" até existir uma integração real (ver [INTEGRATIONS.md](INTEGRATIONS.md)) — **nenhuma credencial é digitada nesta tela**.

## 9. Usuários

**Configurações → Usuários**: cadastre quem vai usar o sistema e com qual papel (Administrador, RH, Gestor, Auditor, Visualizador). Desde a Fase 4 o papel vale de verdade: o servidor verifica a permissão em cada requisição, e a interface esconde o que seria negado. Auditor lê e exporta mas não altera; Gestor trata pendências mas não aprova; só Administrador gere acessos. Ver [AUTH.md](AUTH.md).

Quem estiver cadastrado aqui aparece como opção de **responsável** ao atribuir uma pendência (ver abaixo) — por isso vale cadastrar a equipe antes de começar a operar a fila.

## 10. Começar a usar

Com a empresa configurada, vá em **Assistente HE Diário** e suba os 4 arquivos do primeiro dia (espelho de ponto, escala, rastreio, horário padrão). A partir daí, Dashboard, Pendências, Controle de Ponto, Ranking, Score, Análise por Setor e Relatório por Período já mostram os dados reais dessa empresa.

## 11. O ciclo de uma pendência (dia a dia da operação)

Depois que os arquivos do dia são processados, cada ocorrência fora do padrão vira uma **pendência** rastreável. O caminho completo:

1. **Ver o que precisa de atenção** — abra **Centro de Ações**. Os cards mostram quantas estão abertas, quantas são de alta prioridade, quantas críticas, quantas já venceram o prazo. A fila vem ordenada por prioridade e, em empate, pelo caso mais antigo.
2. **Filtrar** por status, prioridade, colaborador, responsável ou período.
3. **Abrir** um caso → vai para a ficha completa em Pendências.
4. **Entender por que apareceu** — o bloco "Por que isso apareceu?" mostra motivo, regra aplicada, dados considerados e evidências. Nada ali é estimado: o que não existe aparece como "Não disponível".
5. **Priorizar** — o sistema **sugere** uma prioridade (com o motivo escrito ao lado), mas quem decide é você. Aplicar a sugestão é um clique explícito; sua escolha manual nunca é sobrescrita depois.
6. **Atribuir responsável e prazo** — escolha alguém do cadastro de Usuários e uma data-limite (ou use "Sugerir prazo padrão", que aplica o número configurado em Regras).
7. **Acompanhar o prazo** — a pendência passa a mostrar "Dentro do prazo", "Prazo próximo" ou "Prazo vencido" (e, depois de resolvida, se foi dentro ou fora do prazo). Vencidas aparecem em vermelho e no card "Vencidas" do Centro de Ações.
8. **Tratar e resolver** — preencha setor, causa e justificativa, e marque como resolvido.
9. **Revisar** — depois de resolvida, a ficha oferece **Aprovar** ou **Reprovar**, com observação opcional. Resolver **não** é o mesmo que aprovar: a revisão é uma segunda decisão, de outra pessoa se for o caso.
10. **Reabrir, se reprovada** — uma pendência reprovada tem o botão "Reabrir para novo tratamento": ela volta para a fila mantendo responsável e prazo.
11. **Auditar** — cada uma dessas decisões (prioridade, responsável, prazo, resolução, aprovação, reprovação, reabertura) fica registrada em **Auditoria**, com quem fez, quando, o valor anterior, o novo e o motivo.
