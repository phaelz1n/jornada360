# Detecção de linha extra por proximidade

## Intenção

O checklist deve identificar quando o motorista realiza uma linha adicional que aparece na escala, mesmo quando a planilha de ponto não informa uma HE específica. O caso de referência é Anderson Altair Furquim Moitoso: as batidas totalizam 40 minutos acima do padrão e a linha adicional está registrada na escala.

## Objetivos

- Comparar as linhas da escala com os horários do padrão cadastrado.
- Usar proximidade entre o horário da escala e batidas/paradas do rastreador para apontar a linha adicional.
- Exibir a linha, horário e justificativa sugerida no checklist.
- Repassar `totalHE` ao adaptador para que a HE calculada exibida no cartão seja correta.

## Não objetivos

- Não alterar o cálculo oficial da jornada ou das horas extras.
- Não confirmar automaticamente a justificativa do motorista.
- Não considerar qualquer linha extra da escala como realizada sem evidência de horário.

## Regra

Uma linha da escala que não corresponde a nenhum horário padrão será candidata a linha extra quando seu horário estiver próximo de uma batida ou de uma parada do rastreador. A confirmação continuará dependendo do rastreador quando ele estiver disponível; sem rastreador, o checklist exibirá uma pendência baseada na proximidade das batidas.

## Abordagens consideradas

- Manter a exigência de HE positiva e rastreador: conservadora, mas falha no caso do Anderson.
- Usar apenas a duração das batidas: detecta excesso, mas não identifica qual linha foi feita.
- Cruzar escala, padrão e proximidade de batidas/rastreador: escolhida por identificar a linha sem mudar o cálculo de HE.

## Decisões de implementação

- Reutilizar o cruzamento existente em `src/processamento/cruzamento.js`.
- Preservar a tolerância de até 30 minutos para associar horário da escala a evidência.
- Tratar uma batida próxima como evidência suficiente para “possível linha extra” quando não houver parada do rastreador.
- Adicionar testes de regressão para o cenário do Anderson e para a passagem de `totalHE` ao checklist.
