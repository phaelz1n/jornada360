export function normalizeDriverName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toLocaleUpperCase('pt-BR');
}

export function classifyDriverSector(item = {}, cadastro = {}) {
  const name = normalizeDriverName(item.motorista || item.nome);
  return item.setorAtual || item.setor || cadastro[name]?.setor || 'Sem setor';
}

export function summarizeDay(items = []) {
  return items.reduce((summary, item) => {
    summary.registros += 1;
    summary.he1min += Number(item.he1min || 0);
    summary.he2min += Number(item.he2min || 0);
    summary.he3min += Number(item.he3min || 0);
    if (item.interjornada) summary.interjornada += 1;
    if (item.intrajornada || item.intraJornada || item.temLacuna) summary.intrajornada += 1;
    const setor = classifyDriverSector(item);
    summary.porSetor[setor] = (summary.porSetor[setor] || 0) + 1;
    return summary;
  }, { registros: 0, he1min: 0, he2min: 0, he3min: 0, interjornada: 0, intrajornada: 0, porSetor: {} });
}

export function prepareProcessedDay({ dateKey, items = [], source = 'importacao' }) {
  return { dateKey, source, updatedAt: new Date().toISOString(), summary: summarizeDay(items), items: items.map(item => ({ ...item, setorAtual: classifyDriverSector(item) })) };
}
