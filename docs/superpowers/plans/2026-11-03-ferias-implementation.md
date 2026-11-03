# Plano de implementação — Módulo de Férias

## Objetivo

Implementar o módulo `/ferias` dentro do Jornada360, com a mesma identidade visual e os mesmos componentes da aplicação atual, permitindo importar a previsão de férias, cadastrar turnos e feristas, gerar sugestões auditáveis, revisar e aceitar programações com sincronização segura no Firebase.

## Princípios de execução

- Não persistir uma sugestão como programação oficial sem aceite explícito.
- Reutilizar componentes, tokens e estilos existentes do Jornada360.
- Manter os arquivos importados fora do armazenamento permanente; salvar somente dados normalizados e metadados de auditoria.
- Validar regras no cliente para orientar o usuário e no Firebase para garantir segurança.
- Preservar histórico e evitar alterações retroativas em programações aprovadas.
- Fazer commits pequenos, com testes relacionados a cada etapa.

## Etapa 1 — Inventário e fundação visual

1. Mapear a estrutura atual de `src`, rotas implícitas, `AppShell`, autenticação, estilos e componentes de dashboard.
2. Identificar cartões, tabelas, filtros, calendários, modais, badges, alertas e estados de carregamento reutilizáveis.
3. Extrair ou consolidar tokens visuais compartilhados sem alterar o comportamento atual da Jornada.
4. Criar a estrutura de navegação do hub e da rota `/ferias`, preservando a rota existente da Jornada.
5. Criar estado de acesso por sistema e telas de acesso negado, carregamento e ausência de sistemas.

**Verificação:** o Jornada360 atual continua renderizando sem regressão e o usuário autorizado consegue abrir uma página inicial vazia de Férias com o mesmo layout.

## Etapa 2 — Permissões e modelo Firebase

1. Definir os papéis `admin`, `rh`, `consulta_ferias` e `jornada`.
2. Criar o documento de perfil/permissões do usuário, sem depender apenas de e-mail no frontend.
3. Garantir que `operacional4@transpinho.com` seja o administrador inicial por migração controlada.
4. Criar as coleções:
   - `ferias_importacoes`
   - `ferias_pessoas`
   - `ferias_turnos`
   - `ferias_pessoa_turnos`
   - `ferias_feristas`
   - `ferias_sugestoes`
   - `ferias_programacoes`
   - `ferias_auditoria`
5. Criar regras Firestore por papel, operação e status.
6. Criar índices necessários para competência, turno, situação, funcionário e período.

**Verificação:** testes de regras comprovam que consulta não edita, RH não administra permissões e somente usuários autorizados aceitam programação.

## Etapa 3 — Cadastro de turnos e vínculos

1. Criar tela fiel ao cadastro existente para incluir, editar, ativar e inativar turnos.
2. Modelar dias aplicáveis, horários, vigência e compatibilidades.
3. Criar tela para vincular funcionários a turnos com histórico de vigência.
4. Exibir pendências para funcionários sem turno.
5. Implementar sugestão opcional baseada no Jornada360:
   - cadastro explícito;
   - horário padrão;
   - escala recorrente;
   - recorrência de linhas/serviços.
6. Exigir confirmação manual antes de usar a sugestão como vínculo oficial.

**Verificação:** alterações no turno atual não alteram vínculos históricos nem programações aprovadas.

## Etapa 4 — Cadastro de feristas

1. Criar cadastro manual de feristas.
2. Permitir selecionar um ou mais turnos compatíveis.
3. Permitir informar disponibilidade, vigência, observações e situação.
4. Permitir exclusão lógica, preservando uso histórico.
5. Criar visão de disponibilidade e conflitos.

**Verificação:** ferista inativo ou fora da vigência não aparece como opção válida para novas sugestões.

## Etapa 5 — Importador da previsão de férias

1. Criar fluxo de upload semelhante às importações do Jornada360.
2. Extrair os campos identificados no PDF:
   - funcionário;
   - filial e centro de custo;
   - admissão;
   - período aquisitivo;
   - saldo;
   - período de gozo existente;
   - limite de gozo.
3. Normalizar datas e nomes para vincular ao cadastro atual.
4. Apresentar uma prévia antes de confirmar a importação.
5. Detectar duplicidades por competência, funcionário e conteúdo normalizado.
6. Salvar apenas dados normalizados, alertas, hash lógico e metadados do lote.
7. Não salvar o PDF original.

**Verificação:** importar o mesmo arquivo duas vezes não duplica pessoas nem períodos e campos ilegíveis aparecem como pendências revisáveis.

## Etapa 6 — Motor de sugestões

1. Criar função pura para calcular a primeira data possível: data atual + 30 dias corridos.
2. Validar limite de gozo e saldo de dias.
3. Gerar candidatos de período conforme o turno e a disponibilidade operacional configurada.
4. Reservar os dois dias úteis anteriores para treinamento do ferista.
5. Desconsiderar finais de semana e feriados cadastrados na contagem de treinamento.
6. Detectar sobreposição entre férias, treinamentos, folgas, afastamentos e outras coberturas disponíveis.
7. Selecionar ferista compatível ou gerar pendência explicando a ausência.
8. Gerar justificativa detalhada para cada sugestão:
   - regras atendidas;
   - dados de origem;
   - ferista escolhido;
   - dias de treinamento;
   - conflitos ou pendências.
9. Persistir o resultado apenas em `ferias_sugestoes`, com versão e status.

**Verificação:** testes de datas cobrem virada de mês, virada de ano, fins de semana, feriados, limite de gozo e antecedência mínima.

## Etapa 7 — Tela de revisão e aceite

1. Criar tabela interativa de sugestões usando o padrão visual existente.
2. Permitir filtrar por situação, turno, funcionário, ferista e conflito.
3. Abrir detalhe clicável com origem, regras e explicações.
4. Permitir editar período, turno, ferista, treinamento e observações.
5. Recalcular as validações após qualquer edição.
6. Bloquear aceite quando houver erro crítico, salvo override autorizado com justificativa.
7. Permitir rejeitar, aceitar individualmente e aceitar em lote somente registros válidos.
8. Ao aceitar, criar ou atualizar `ferias_programacoes` e registrar `ferias_auditoria`.

**Verificação:** uma sugestão aceita vira programação oficial; uma sugestão apenas editada continua sendo rascunho.

## Etapa 8 — Dashboard de férias

1. Reutilizar a composição visual da dashboard do Jornada360.
2. Criar cartões de pendências, aprovações, conflitos, limites e treinamentos.
3. Criar calendário mensal interativo.
4. Criar linha do tempo por turno.
5. Criar quadro de disponibilidade dos feristas.
6. Permitir clicar em qualquer indicador para abrir os funcionários envolvidos.
7. Implementar modo noturno com contraste validado.
8. Mostrar estado de sincronização Firebase e diferenciar dado carregado de falha posterior de comunicação.

**Verificação:** todos os números da dashboard devem ser derivados do mesmo conjunto filtrado e reconciliar com a tabela detalhada.

## Etapa 9 — Auditoria, migração e qualidade

1. Criar auditoria para importação, edição, aceite, rejeição, cancelamento, troca de ferista e alteração de turno.
2. Criar rotina segura para dados iniciais, sem apagar dados existentes.
3. Adicionar testes unitários do motor de regras e normalizador.
4. Adicionar testes de integração para Firestore e permissões.
5. Executar build, lint, testes e verificação visual responsiva.
6. Revisar acessibilidade de contraste, foco, teclado e mensagens de erro.
7. Fazer commit por etapa concluída, com mensagem descritiva.

## Critérios de aceite

- O módulo está acessível no hub somente para usuários autorizados.
- A interface é visualmente coerente com o Jornada360 em claro e escuro.
- Turnos podem ser cadastrados e vinculados manualmente.
- Feristas podem ser cadastrados, inativados e associados aos turnos.
- O PDF gera uma prévia normalizada sem salvar o arquivo original.
- Sugestões obedecem antecedência de 30 dias, limite de gozo e treinamento de 2 dias úteis.
- O RH pode editar e aceitar sugestões.
- Somente o aceite cria programação oficial no Firebase.
- A dashboard reconcilia com os detalhes e exibe conflitos clicáveis.
- Auditoria registra todas as alterações relevantes.
- Testes e build passam antes de qualquer entrega.
