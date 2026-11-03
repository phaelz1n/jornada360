export function buildChecklistAudit(snapshot = {}, dateKey = 'latest', actorEmail = '', updatedAt = new Date().toISOString()) {
  return {
    action: 'checklist_atualizado',
    dateKey,
    actorEmail: String(actorEmail || ''),
    updatedAt,
    itemCount: Array.isArray(snapshot.itemIds) ? snapshot.itemIds.length : 0,
    validatedCount: Array.isArray(snapshot.validatedIds) ? snapshot.validatedIds.length : 0,
    detailCount: snapshot.details && typeof snapshot.details === 'object' ? Object.keys(snapshot.details).length : 0
  };
}
