# Módulo de Controle de Férias — Especificação de Design

**Data:** 2026-11-03  
**Status:** Proposta para aprovação

## Objetivo

Criar o módulo `/ferias` integrado ao Jornada360 para importar a previsão de férias em PDF, manter o cadastro de funcionários e turnos, sugerir períodos que respeitem as regras operacionais e permitir que o RH revise, edite e aceite cada programação antes de gravá-la como oficial no Firebase.

O sistema não deve considerar uma sugestão automática como decisão final. Toda sugestão será um rascunho até ser aceita por um usuário autorizado.

## Decisões principais

### Aplicação integrada

O módulo será adicionado ao projeto atual, compartilhando:

- autenticação Firebase;
- cadastro de funcionários já existente;
- permissões por sistema;
- infraestrutura de auditoria;
- componentes visuais e navegação do Jornada360.

Após o login, o usuário verá somente os sistemas que possui permissão para acessar: Jornada360, Férias ou ambos.

### Identidade visual compartilhada

O módulo de férias deverá ser visualmente fiel ao Jornada360 atual, pois os dois sistemas pertencem à mesma empresa e serão usados no mesmo fluxo operacional. Não será criado um design independente.

Serão reutilizados, sempre que possível:

- paleta de cores, tipografia, espaçamentos e bordas do Jornada360;
- cabeçalho, menu, conta do usuário e indicador de sincronização;
- cartões de resumo e componentes de dashboard;
- tabelas, filtros, seletores de período e calendários;
- badges de status, alertas, modais, campos e botões;
- estados de carregamento, vazio, erro e sucesso;
- modo claro e modo noturno, mantendo contraste adequado;
- comportamento responsivo para os mesmos tamanhos de tela.

O usuário deverá sentir que está navegando dentro do mesmo produto. A troca entre Jornada360 e Férias será feita pelo hub de sistemas, preservando o usuário logado e o contexto visual. Novos componentes só serão criados quando não houver equivalente reutilizável no Jornada360.

Antes da implementação visual, será feito um inventário dos componentes existentes para evitar duplicação de CSS e divergência de comportamento. As telas do módulo de férias deverão consumir os mesmos tokens e componentes compartilhados do projeto.

### Turnos cadastrados manualmente

O cadastro manual será a fonte oficial dos turnos. O Jornada360 poderá oferecer uma sugestão inicial baseada nos horários e escalas existentes, mas essa sugestão deverá ser revisada e confirmada pelo RH.

Cada funcionário terá um vínculo explícito com um turno. Funcionários sem vínculo aparecerão como pendência e não terão uma programação automática aprovada até que o turno seja definido.

### Sugestão, revisão e aprovação

O fluxo será:

1. importar o PDF;
2. extrair e revisar os funcionários e períodos aquisitivos;
3. associar cada funcionário ao seu turno;
4. cadastrar ou selecionar feristas;
5. gerar sugestões de cobertura;
6. revisar e editar as sugestões;
7. aceitar individualmente ou em lote;
8. persistir as programações oficiais e registrar a auditoria.

Sugestões rejeitadas ou ainda não aceitas continuarão identificadas como rascunho. Elas não serão confundidas com férias programadas.

## Regras de negócio

### Férias

- A data inicial deve respeitar no mínimo 30 dias corridos de antecedência em relação à data de programação/aceite.
- A programação deve respeitar o limite de gozo extraído do PDF.
- O saldo de dias do PDF será a quantidade sugerida, sujeita à edição autorizada.
- O período poderá ser editado antes da aprovação.
- O sistema deve sinalizar, sem esconder, qualquer período fora das regras.
- O sistema deve impedir a aprovação de uma sugestão com erro crítico, salvo se houver uma permissão específica para override com justificativa.
- Períodos já existentes no PDF serão tratados como histórico ou referência, não serão sobrescritos automaticamente.
- Programações aprovadas terão status, autor, data de aprovação e versão.

### Cobertura

- A pessoa substituta deve estar vinculada ao mesmo turno ou a um turno compatível configurado pelo RH.
- Um motorista não pode cobrir dois afastamentos sobrepostos.
- A disponibilidade do substituto deve cobrir todo o período aprovado.
- O substituto precisa de pelo menos 2 dias úteis de treinamento antes do início das férias.
- O sistema deve mostrar as datas de treinamento e impedir conflito com férias, folgas ou outra alocação incompatível quando esses dados estiverem disponíveis.
- O RH poderá trocar o motorista substituto manualmente, mas a alteração deverá gerar nova validação.
- Feristas serão cadastrados, editados e removidos manualmente.

### Turnos

Um turno terá, no mínimo:

- nome;
- descrição;
- dias aplicáveis;
- horários ou jornada esperada;
- funcionários vinculados;
- feristas compatíveis;
- situação ativo/inativo.

O sistema deverá permitir que um funcionário tenha histórico de turnos, preservando a vigência de cada vínculo. Alterar o turno atual não deve modificar retroativamente uma programação já aprovada.

## Importação do PDF

O PDF será processado sem ser armazenado como arquivo permanente. Serão salvas somente as informações utilizadas na auditoria e no planejamento:

- identificador do funcionário;
- nome;
- filial;
- centro de custo;
- data de admissão;
- período aquisitivo;
- saldo de dias;
- período de gozo existente;
- limite de gozo;
- origem da informação;
- identificador da importação;
- alertas de leitura ou campos ausentes.

A importação deverá ser idempotente. O mesmo PDF não poderá criar duplicidades silenciosamente. Cada lote terá uma chave de deduplicação baseada na origem, competência, funcionário e conteúdo normalizado.

## Modelo de dados sugerido

Coleções do Firestore:

### `ferias_importacoes`

Metadados do lote importado: competência, usuário, data, quantidade de registros, hash lógico, status e alertas.

### `ferias_pessoas`

Dados normalizados extraídos do PDF e referências ao funcionário existente no cadastro do Jornada360.

### `ferias_turnos`

Turnos mantidos pelo RH, com regras de jornada, vigência, compatibilidade e status.

### `ferias_pessoa_turnos`

Vínculo entre pessoa e turno, com vigência, origem, confirmação e histórico.

### `ferias_feristas`

Cadastro manual de feristas, turnos compatíveis, disponibilidade, situação e observações.

### `ferias_sugestoes`

Rascunhos gerados pelo motor de regras. Devem conter explicação das regras atendidas, pendências, conflitos, cobertura escolhida e versão da sugestão.

### `ferias_programacoes`

Somente períodos aceitos pelo RH. Contém período, pessoa, turno, substituto, treinamento, status, usuário e data de aprovação.

### `ferias_auditoria`

Histórico de importações, alterações, aceitações, rejeições, cancelamentos e overrides.

## Dashboard

A dashboard do módulo `/ferias` terá filtros por competência, período, turno, filial, situação e responsável. Os principais cartões serão:

- férias pendentes de revisão;
- sugestões prontas para aceitar;
- programações aprovadas;
- pessoas sem turno;
- turnos sem ferista;
- conflitos de cobertura;
- treinamentos pendentes;
- períodos com menos de 30 dias;
- limites de gozo próximos;
- alterações recentes.

Visualizações previstas:

- calendário mensal com férias, treinamento e conflitos;
- linha do tempo por turno;
- tabela interativa de sugestões;
- quadro de disponibilidade dos feristas;
- lista clicável de pendências com os funcionários envolvidos e a regra que falhou;
- comparação entre sugestão original e programação aprovada.

O layout seguirá a composição já conhecida do Jornada360: título da seção, período/filtros, cartões executivos, blocos analíticos e listas detalhadas. A dashboard não deve introduzir padrões visuais que pareçam pertencer a outro sistema.

## Permissões

- `admin`: administra usuários, permissões, turnos, feristas e configurações.
- `rh`: importa dados, revisa, edita e aprova programações.
- `consulta_ferias`: visualiza dashboard e programações sem alterar dados.
- `jornada`: acesso somente ao módulo de jornada, conforme permissão.

O e-mail `operacional4@transpinho.com` será o administrador inicial. As regras do Firestore deverão validar a permissão no servidor, não apenas esconder menus na interface.

## Segurança e auditoria

- Arquivos originais não serão salvos no Storage por padrão.
- Nenhuma programação oficial será criada sem uma ação explícita de aceite.
- Alterações após aprovação exigirão registro da justificativa.
- Exclusões relevantes serão preferencialmente lógicas, preservando o histórico.
- As regras do Firestore devem impedir que usuários de consulta criem ou editem turnos, feristas e programações.
- Toda ação deve registrar usuário, horário, entidade, valores anteriores e novos valores quando aplicável.

## Validações e estados

Estados de sugestão: `rascunho`, `pronta`, `com_pendencias`, `rejeitada`, `aceita`.  
Estados de programação: `aprovada`, `cancelada`, `concluida`.

Uma sugestão deverá explicar claramente:

- qual regra foi atendida;
- qual ferista foi escolhido e por quê;
- quais dias de treinamento foram reservados;
- quais dados vieram do PDF;
- quais dados vieram do cadastro manual;
- quais problemas impedem a aprovação.

## Testes necessários

- PDF repetido não cria registros duplicados.
- Funcionário sem turno aparece como pendência.
- Sugestão com menos de 30 dias é rejeitada ou sinalizada como bloqueada.
- Limite de gozo é respeitado.
- Dois dias úteis de treinamento são calculados corretamente em viradas de mês e feriados cadastrados.
- Ferista indisponível gera conflito explícito.
- Substituto não pode ser alocado em períodos sobrepostos.
- Editar uma sugestão recalcula cobertura e pendências.
- Apenas o aceite cria uma programação oficial.
- Usuário sem permissão não consegue alterar dados via Firebase.
- Mudanças em turno não alteram programações antigas.

## Fora do escopo inicial

- Envio automático de comunicação ao funcionário.
- Integração com folha de pagamento.
- Armazenamento do PDF original.
- Aprovação automática sem revisão do RH.
- Inferência definitiva de turnos apenas a partir do Jornada360.

## Próxima etapa

Após a aprovação desta especificação, será criado o plano técnico de implementação, dividido em autenticação e permissões, modelo Firebase, importação do PDF, cadastro de turnos/feristas, motor de sugestões, dashboard e testes.
