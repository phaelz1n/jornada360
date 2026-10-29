function normalizeName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

const SPECIAL_CATEGORIES = new Map([
  ...['GIOVANI OLIVEIRA', 'CLAITON OLIVEIRA', 'LEONARDO PINHEIRO', 'ALESSANDRO BANDEIRA', 'VINICIUS OLIVEIRA', 'HERSON GUEDES', 'EDUARDO PEREIRA'].map(name => [name, 'Reserva']),
  ...['BRUNO CHUQUEL', 'EDER LEANDRO', 'MAICON MONTEIRO', 'MARCOS MARTINS', 'ALECSANDRO RIBEIRO', 'ISRAEL COSTA'].map(name => [name, 'Cobre férias']),
  ['OLIVIO RODRIGUES', 'Folguista'],
]);

function keyName(value) { return normalizeName(value).toLocaleUpperCase('pt-BR'); }

function removeUndefined(value) {
  if (Array.isArray(value)) return value.map(removeUndefined);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined).map(([key, entry]) => [key, removeUndefined(entry)]));
  }
  return value;
}

export function buildMigrationPayload(backup) {
  const days = Array.isArray(backup?.dias) ? backup.dias : [];
  const drivers = new Map();
  const savedCategories = new Map();
  for (const day of days) {
    for (const [name, state] of Object.entries(day?.caseState || {})) {
      const sector = normalizeName(state?.setor || state?.categoria);
      if (sector) savedCategories.set(keyName(name), sector);
    }
  }
  for (const day of days) {
    const items = day?.snapshot?.items || [];
    for (const item of items) {
      const nome = normalizeName(item.motorista || item.nome);
      if (!nome) continue;
      const setor = normalizeName(item.setorAtual || item.setor || item.setorResponsavel || savedCategories.get(keyName(nome)) || SPECIAL_CATEGORIES.get(keyName(nome)) || '') || 'Sem setor';
      const current = drivers.get(nome);
      drivers.set(nome, removeUndefined({
        nome,
        setor: current?.setor && current.setor !== 'Sem setor' ? current.setor : setor,
        categoria: item.categoria || current?.categoria || SPECIAL_CATEGORIES.get(keyName(nome)) || setor,
        atualizadoEm: backup.geradoEm || new Date().toISOString(),
      }));
    }
  }
  return {
    version: backup?.versao || 1,
    origem: backup?.origem || 'backup-local',
    geradoEm: backup?.geradoEm || new Date().toISOString(),
    drivers: [...drivers.values()],
    days: days.filter(day => day?.dateKey).map(day => ({
      dateKey: day.dateKey,
      snapshot: removeUndefined(day.snapshot || {}),
      caseState: removeUndefined(day.caseState || {}),
    })),
  };
}

export function migrationStats(payload) {
  return { drivers: payload?.drivers?.length || 0, days: payload?.days?.length || 0 };
}
