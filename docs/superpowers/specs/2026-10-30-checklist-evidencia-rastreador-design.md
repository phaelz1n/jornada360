# Evidência de rastreador no checklist

## Intenção

Dar visibilidade compacta, por motorista, sobre o que está dentro do horário padrão, o que está fora e se cada trecho possui evidência próxima no rastreador. O objetivo é diferenciar extra prevista de extra aparentemente real e reduzir falsos alertas de padrão.

## Regras

- O cartão fechado mostra apenas estado geral, padrão, total, dentro, fora e uma indicação de rastreio.
- Ao clicar, abre os blocos detalhados por trecho/horário, com escala, batida, rastreador e diferença em minutos.
- Verde significa que o trecho tem rastreio próximo; vermelho significa que não há evidência próxima; amarelo significa divergência ou baixa confiança.
- O padrão suspeito será sinalizado quando o realizado pelo rastreador repetir uma duração semelhante ao longo de pelo menos cinco dias, enquanto o padrão cadastrado continuar divergente. O alerta aparece no sexto dia.
- Reimportações recalculam a evidência do dia sem apagar observações do checklist.

## Fora do escopo

- Alterar automaticamente o horário padrão cadastrado.
- Classificar trânsito como causa definitiva sem confirmação humana.

## Decisão de interface

Usar cartão expansível no checklist, com cor determinada pela quantidade e severidade dos problemas. A informação detalhada fica disponível no próprio cartão para não poluir a listagem.
