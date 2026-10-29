# Dashboard diária e por período de fechamento — Jornada360

## Intenção

Substituir a visualização fragmentada dos relatórios por uma dashboard React que permita consultar o resultado de um dia específico e o consolidado da competência operacional. A competência sempre começa no dia 28 do mês anterior e termina no dia 27 do mês de referência; por exemplo, `28/09/2026 a 27/10/2026`.

## Objetivos

- Exibir um resumo diário filtrado por data.
- Exibir o resumo consolidado do período 28–27.
- Mostrar registros, horas e colaboradores por HE.1, HE.2 e HE.3.
- Preservar os cruzamentos ponto × escala × rastreador.
- Preservar setores, interjornada, intrajornada e detalhamento por motorista.
- Permitir filtrar o consolidado por setor, motorista e tipo de ocorrência.
- Reutilizar os dados já processados e os dados persistidos no Firebase.
- Atualizar o Firestore e a dashboard automaticamente a cada nova importação.
- Exibir a comparação operacional com os estados detalhados do modelo de checklist.

## Fora do escopo

- Alterar a regra operacional de classificação das batidas.
- Recalcular ou substituir os dados históricos importados.
- Criar uma nova integração com o Ponto Icarus nesta etapa.
- Migrar para outra biblioteca de interface.

## Restrições e regras

- A competência `M` é `[28/(M-1), 27/M]`.
- A data diária deve ser comparada pela chave local `YYYY-MM-DD`, sem deslocamento de fuso.
- O resumo de período deve somar os dias processados dentro da competência, sem duplicar o mesmo motorista no total de colaboradores.
- HE.1, HE.2 e HE.3 devem usar os minutos já normalizados pelo processamento. HE.3 também deve receber as horas identificadas no relatório de ponto como trabalho em feriado ou DSR, mesmo quando não ultrapassarem o limite de quatro horas; quando houver somente o total excedente, a divisão continua sendo HE.1 até 120 minutos, HE.2 até 240 minutos acumulados e HE.3 após 240 minutos.
- A ausência de escala ou rastreador deve permanecer visível como ocorrência de cruzamento incompleto.
- Setor salvo no cadastro tem precedência sobre “Sem setor” e deve ser aplicado nas importações futuras.
- O snapshot diário deve ser salvo por chave de data e substituído de forma idempotente quando o mesmo dia for importado novamente.
- A dashboard deve escutar mudanças do Firestore em tempo real, sem exigir recarregar a página.
- A comparação deve preservar divergência forte, acima do padrão, rastreador incompleto, batidas não confirmadas, batidas fora da janela do rastreador e o detalhe textual da cobertura do rastreador.

## Abordagens consideradas

1. **Estender a dashboard React existente (escolhida).** Reutiliza `processamento-model`, `dashboard-data`, os adaptadores do checklist e o armazenamento Firebase. Reduz divergências entre checklist e relatório.
2. **Criar uma tela de relatório independente.** Facilita uma reformulação visual, mas duplicaria filtros e agregações.
3. **Reescrever a aplicação em uma única tela.** Simplifica a navegação, porém aumenta o risco de alterar o fluxo operacional já usado.

A primeira abordagem foi escolhida porque preserva a lógica existente e permite adicionar o período 28–27 em uma camada de consulta compartilhada.

## Desenho proposto

### Período

Criar um utilitário puro para:

- calcular a competência que contém uma data;
- gerar a chave e o rótulo `28/09/2026 a 27/10/2026`;
- enumerar as datas da competência;
- lidar com virada de ano e fevereiro usando `Date` UTC/local controlada.

### Consulta e agregação

Criar uma camada de consulta que receba os snapshots disponíveis e produza:

- `daily`: itens e totais de uma data;
- `period`: itens agregados e totais da competência;
- totais separados de HE.1, HE.2 e HE.3;
- horas de HE.3 identificadas como feriado/DSR no relatório de ponto;
- interjornada, intrajornada e cruzamentos incompletos;
- agrupamentos por setor e por motorista.

Cada item de comparação terá também `statusComparacao`, `statusRastreador`, `detalhesComparacao`, `batidasConfirmadas`, `batidasTotais`, `horarioPadrao`, `padraoCadastrado` e `sugestaoJustificativa`, quando essas informações estiverem disponíveis nas fontes.

O agregado por motorista manterá a lista de dias ocorridos, o total de minutos por categoria e as ocorrências de comparação, permitindo abrir o resumo daquele motorista sem navegar para o checklist.

### Interface

- Seletor de modo: `Por dia` e `Por período`.
- Seletor de data para o modo diário.
- Seletor de competência para o modo de período.
- Cartões de resumo para HE.1, HE.2, HE.3, interjornada e intrajornada.
- Tabela filtrável por motorista, setor e categoria.
- Detalhe expansível por motorista com os dias e os horários comparados.
- Estado vazio e indicação clara de fontes ausentes.

### Persistência

As consultas lerão primeiro os snapshots disponíveis no Firebase e usarão o fallback local já existente quando não houver dados remotos. A importação continuará gravando o registro do arquivo e o snapshot processado; uma nova planilha deverá atualizar o dia correspondente sem apagar os demais dias da competência. O armazenamento exporá uma assinatura em tempo real baseada em `onSnapshot`, e o AppShell recalculará os relatórios quando o snapshot mudar.

## Critérios de aceitação

- Para a data `27/10/2026`, o período exibido é `28/09/2026 a 27/10/2026`.
- Para a data `28/10/2026`, o período exibido é `28/10/2026 a 27/11/2026`.
- O resumo diário muda ao trocar a data sem alterar o período selecionado indevidamente.
- O resumo por período soma todos os dias entre 28 e 27 e não duplica colaboradores.
- Um excedente de 150 minutos resulta em HE.1 = 120 e HE.2 = 30.
- Um excedente de 300 minutos resulta em HE.1 = 120, HE.2 = 120 e HE.3 = 60.
- Uma linha marcada como feriado ou DSR no relatório de ponto entra no total de HE.3, ainda que o excedente seja inferior a 240 minutos.
- Filtros por setor e motorista alteram somente a listagem e os totais exibidos daquele recorte.
- Os casos sem escala ou sem rastreador continuam identificados.
- Uma nova importação do mesmo dia substitui o snapshot anterior e atualiza a dashboard sem F5.
- Uma importação de outro dia preserva os dias já existentes.
- O caso do modelo exibe etiquetas e detalhes de divergência/rastreador, sem perder batidas, horário padrão, padrão cadastrado, justificativa e setor.
- Os testes existentes de cruzamento, setores, checklist e horas extras continuam passando.

## Pendências de implementação

- Implementar e testar o utilitário de competência.
- Implementar a agregação diária e por período.
- Integrar os controles à dashboard React.
- Adicionar testes de virada de mês, agregação e filtros.
- Validar build e comportamento publicado.
