# Painel Jornada360 — Design de substituição completa

## Intenção

Substituir a interface e o fluxo do painel HTML antigo por um painel React/Tailwind único, mantendo os resultados operacionais já conhecidos. O HTML antigo será usado somente como referência durante a validação e não ficará disponível no produto final.

## Objetivos

- Centralizar Importação, Processamento, Checklist, Relatórios, Cadastros e Firebase em módulos claros.
- Preservar a comparação ponto × escala × rastreador, incluindo nomes abreviados e correspondências seguras.
- Classificar horas extras em HE.1, HE.2 e HE.3 com faixas cumulativas: até 120 minutos em HE.1, de 121 a 240 minutos no excedente HE.2 e acima disso no excedente HE.3.
- Manter setorização automática, categorias especiais, validação em massa e persistência por dia.
- Atualizar os resumos de HE.1/HE.2/HE.3, interjornada e intrajornada sempre que uma nova planilha for processada.
- Garantir migração e leitura dos dados já existentes no Firebase.

## Fora do escopo

- Trocar a API do Ponto Icarus sem endpoint documentado e validado.
- Alterar as regras trabalhistas sem um caso de referência fornecido pelo usuário.
- Manter uma segunda interface operacional do painel antigo após a conclusão.

## Abordagens consideradas

1. Reescrita total imediata: rápida visualmente, mas arriscada porque regras poderiam ser perdidas.
2. Migração modular com equivalência: cada módulo é refeito e testado contra as funções e resultados do legado antes de substituir o seguinte. Escolhida por reduzir regressões.
3. Apenas modernização visual: insuficiente porque não resolve a separação de responsabilidades nem a atualização dos resumos.

## Arquitetura escolhida

O React será a única camada de apresentação. O processamento ficará em funções puras sem dependência de Firebase ou DOM; os adaptadores de planilhas converterão cada fonte para um modelo canônico. O Firebase será usado apenas nos repositórios de persistência, permitindo testar o processamento localmente.

Fluxo principal:

1. Usuário seleciona as planilhas do dia.
2. Normalizadores extraem ponto, escala, horário padrão e rastreador.
3. O cruzamento normaliza nomes, procura correspondência exata e, quando seguro, usa abreviações.
4. A classificação calcula HE.1/HE.2/HE.3, interjornada e intrajornada.
5. O resultado é persistido como snapshot do dia.
6. Checklist e relatórios consomem o mesmo snapshot, sem recalcular regras de forma independente.

## Contrato de equivalência

Cada regra crítica terá teste com dados reais anonimizados ou exemplos equivalentes:

- mesma pessoa em nomes diferentes entre ponto, escala e rastreador;
- linha de escala compatível com batida fora do horário padrão;
- 2h, 2h30, 4h e 4h30 de extra;
- motorista sem setor, motorista especial e motorista categorizado;
- interjornada e intrajornada;
- reprocessamento do mesmo dia sem duplicar dados;
- nova planilha atualizando o snapshot e os relatórios.

## Critério de conclusão

O painel novo substitui a interface antiga quando os testes de processamento passam, o build de produção passa, o login e Firebase funcionam, a importação atualiza o snapshot, e os relatórios exibem os mesmos totais esperados nos cenários de equivalência.

## Decisões do usuário

- O painel antigo será substituído totalmente.
- A lógica principal deve permanecer igual ou produzir resultado equivalente.
- A implementação permanece nativa em React/Tailwind por enquanto.
