# Cadastro de padrão dos motoristas e sincronização do Jornada360

## Objetivo

Tornar o cadastro do motorista a fonte oficial do horário padrão e das regras de jornada, mantendo a planilha apenas como apoio à migração inicial.

## Escopo

- Criar e editar no cadastro nome, setor, horários, extra prevista e situação do padrão.
- Criar automaticamente motoristas encontrados na importação diária como “Pendente de padrão”.
- Usar o padrão cadastrado nos cálculos de jornada, extras, HE.1/HE.2/HE.3, interjornada, intrajornada, intervalos, escala, rastreador, relatórios, dashboard, checklist e justificativas.
- Identificar linhas/rotas extras por proximidade de horário, informando a rota na justificativa quando disponível.
- Aplicar a política de ADM: não exigir padrão/rastreador; qualquer extra acima da jornada base é ocorrência obrigatória, sem extra prevista.
- Modernizar a tela de cadastros e manter o modo escuro consistente.

## Estado da implementação

- [x] Conversão do cadastro para fonte de cálculo nas importações.
- [x] Criação automática de motoristas novos como pendentes.
- [x] Editor moderno de padrões no cadastro.
- [x] Justificativa de rota extra e sinalização de extra indevida para ADM.
- [x] Recalcular snapshots já importados imediatamente após alteração do cadastro.
- [x] Tornar a planilha de horário padrão opcional na importação diária.
- [x] Sincronizar jornada prevista, extras e buckets HE com o padrão cadastrado.
- [x] Auditar consumidores do snapshot: dashboard, relatórios, checklist e justificativas usam os campos processados.
- [x] Executar suíte completa e registrar commits.
