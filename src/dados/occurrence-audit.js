export function buildOccurrenceAudit(event = {}, actorEmail = '', createdAt = new Date().toISOString()) {
  return {
    action: 'ocorrencia_criada',
    dateKey: event.dataKey,
    actorEmail: String(actorEmail || ''),
    createdAt,
    occurrenceType: String(event.tipo || ''),
    minutes: Number(event.minutos) || 0
  };
}
