# Auditoria matemática de horários e evolução do dashboard

## Intenção

Aumentar a confiança do Jornada360 em duas frentes: localizar e corrigir falhas matemáticas comprováveis em duração, virada de meia-noite, metas e classificação de horas extras; e transformar o dashboard em uma leitura analítica útil para operação e RH.

## Objetivos

- Auditar o fluxo ponto → padrão → escala → rastreador → snapshot → relatório.
- Criar testes para casos de virada de dia, horários incompletos, padrões negativos, intervalos e buckets HE.1/HE.2/HE.3.
- Corrigir somente comportamentos demonstrados pelos testes e preservar a lógica de reimportação/checklist.
- Adicionar uma camada de agregação analítica separada da apresentação.
- Criar gráficos responsivos em React/CSS/SVG, sem dependência externa nova.
- Manter explicação curta e legível em cada visualização.

## Fora do escopo

- Alterar regras de autenticação, Firestore ou formato das planilhas sem necessidade comprovada.
- Reescrever o dashboard inteiro.
- Introduzir biblioteca de gráficos antes de confirmar que SVG/CSS não atende.
- Alterar dados históricos automaticamente ou fazer push para o GitHub.

## Abordagens consideradas

1. Correções pontuais e gráficos diretamente no componente: menor alteração, mas mistura cálculo e apresentação e dificulta testes.
2. Camada analítica do dashboard — escolhida: funções puras para séries, composição, distribuição e alertas; o componente apenas renderiza os dados. Reduz risco e permite evolução.
3. Reformulação visual ampla: maior impacto, mas escopo e risco desnecessários nesta etapa.

## Regras matemáticas a validar

- Duração de pares deve somar corretamente quando a saída ocorre no dia seguinte.
- Comparações de horário devem usar uma representação coerente em jornadas noturnas.
- Horas negativas do padrão nunca podem aumentar meta, extra ou excedente.
- HE.1, HE.2 e HE.3 devem somar o total real sem dupla contagem.
- Dentro do padrão, acima do padrão e sem padrão precisam ser categorias mutuamente coerentes.
- Intervalos devem considerar a sequência real das batidas, inclusive virada de meia-noite.
- A meta do ciclo deve continuar baseada na média dos padrões diários válidos importados.

## Gráficos propostos

- **Evolução do ciclo:** linha/área com total HE, dentro do padrão, acima do padrão e meta por dia.
- **Composição de extras:** barras empilhadas HE.1/HE.2/HE.3 por ciclo ou por setor.
- **Distribuição por motorista:** ranking horizontal com total, excedente e número de ocorrências.
- **Risco operacional:** matriz de alertas com interjornada, intrajornada, falta de padrão e rastreio divergente.
- **Comparação de setores:** barras agrupadas de HE total, dentro e acima do padrão.

Todos terão estado vazio, texto explicativo, valores acessíveis em texto e comportamento responsivo.

## Arquivos prováveis

- `src/processamento/` e `src/relatorios/` para testes e correções matemáticas.
- Novo módulo puro em `src/dados/` ou `src/modules/` para agregações analíticas.
- `src/modules/InicioDashboard.jsx` para composição visual.
- `src/styles.css` para layout e responsividade.

## Critérios de aceitação

- Cada correção matemática tem teste regressivo reproduzível.
- Os 84 testes existentes continuam passando e novos testes ficam verdes.
- `npm run build` passa.
- O dashboard mantém os filtros por dia/ciclo e não perde os indicadores atuais.
- Os gráficos não dependem de dados externos nem de uma biblioteca adicional.
- `git diff --check` passa.

## Decisões deixadas ao implementador

- Escolher a representação SVG/CSS mais simples para cada gráfico.
- Priorizar no primeiro corte os gráficos que cabem sem rolagem excessiva: evolução diária, composição por bucket, distribuição por motorista e alertas.
- Se a auditoria encontrar uma regra de negócio ambígua que altere valores históricos, parar e pedir decisão antes de mudar o cálculo.
