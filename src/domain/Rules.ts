/* Regras de negócio configuráveis por workspace — nada disso deve ser constante fixa no código.
 * `toleranceMin`/`dailyGoalMin`/`recurrenceLimit` já são aplicados de verdade pelo motor
 * (services/toleranceService, recurrenceService). `intervalMinMin`/`interjourneyMinHours` ficam
 * documentados aqui como próximo passo — hoje o motor real ainda aplica esses dois com um valor
 * fixo internamente (ver BUSINESS_RULES.md); trazê-los pra cá é trabalho de Fase 2.
 * `prazoPadraoDias`/`alertaAntecedenciaDias` (Fase 2, Etapa 6/7) alimentam o SLA da Pendencia —
 * ver services/slaService.ts. Nenhum dos dois é aplicado automaticamente: `prazoPadraoDias` só
 * SUGERE uma data (o usuário decide aplicar ou não, mesmo padrão de priorizacaoService), e
 * `alertaAntecedenciaDias` só afeta a classificação visual de um prazo já definido por alguém. */
export interface Rules {
  toleranceMin: number;
  dailyGoalMin: number;
  recurrenceLimit: number;
  intervalMinMin: number;
  interjourneyMinHours: number;
  prazoPadraoDias: number;
  alertaAntecedenciaDias: number;
}

/* Defaults neutros pra qualquer workspace novo — nenhum é o número específico da operação atual:
 * - toleranceMin (10min) e recurrenceLimit (5x): pontos de partida genéricos razoáveis, não
 *   amarrados a nenhuma empresa; o próprio Fase 1 já permitia isso ficar como está.
 * - intervalMinMin (60min) e interjourneyMinHours (11h): referência legal (CLT) aplicável a
 *   qualquer empresa brasileira, não um número da operação atual.
 * - dailyGoalMin (0): NÃO assume a meta diária de HE de nenhuma empresa. Fica em 0 até o
 *   administrador configurar — ver Configurações → Regras.
 * - prazoPadraoDias (3) e alertaAntecedenciaDias (1): pontos de partida genéricos pra qualquer
 *   operação (Fase 2, Etapa 6/7) — não inventam um SLA real de nenhuma empresa, só dão um valor de
 *   partida editável em Configurações → Regras antes de o Jornada360 sugerir qualquer prazo. */
export function regrasPadrao(): Rules {
  return {
    toleranceMin: 10,
    dailyGoalMin: 0,
    recurrenceLimit: 5,
    intervalMinMin: 60,
    interjourneyMinHours: 11,
    prazoPadraoDias: 3,
    alertaAntecedenciaDias: 1,
  };
}
