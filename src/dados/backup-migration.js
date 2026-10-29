function normalizeName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

export function buildMigrationPayload(backup) {
  const days = Array.isArray(backup?.dias) ? backup.dias : [];
  const drivers = new Map();
  for (const day of days) {
    const items = day?.snapshot?.items || [];
    for (const item of items) {
      const nome = normalizeName(item.motorista || item.nome);
      if (!nome) continue;
      const setor = normalizeName(item.setorAtual || item.setor || item.setorResponsavel || '') || 'Sem setor';
      const current = drivers.get(nome);
      drivers.set(nome, {
        nome,
        setor: current?.setor !== 'Sem setor' ? current?.setor : setor,
        categoria: item.categoria || current?.categoria || setor,
        atualizadoEm: backup.geradoEm || new Date().toISOString(),
      });
    }
  }
  return {
    version: backup?.versao || 1,
    origem: backup?.origem || 'backup-local',
    geradoEm: backup?.geradoEm || new Date().toISOString(),
    drivers: [...drivers.values()],
    days: days.filter(day => day?.dateKey).map(day => ({
      dateKey: day.dateKey,
      snapshot: day.snapshot || {},
      caseState: day.caseState || {},
    })),
  };
}

export function migrationStats(payload) {
  return { drivers: payload?.drivers?.length || 0, days: payload?.days?.length || 0 };
}
