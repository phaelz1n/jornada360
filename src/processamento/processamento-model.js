export function normalizeDriverName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toLocaleUpperCase('pt-BR');
}

export function classifyDriverSector(item = {}, cadastro = {}) {
  const name = normalizeDriverName(item.motorista || item.nome);
  return item.setorAtual || item.setor || cadastro[name]?.setor || 'Sem setor';
}

export function splitExtraHours(totalMinutes = 0) {
  const total = Math.max(0, Number(totalMinutes) || 0);
  const he1min = Math.min(total, 120);
  const he2min = Math.min(Math.max(total - 120, 0), 120);
  const he3min = Math.max(total - 240, 0);
  return { he1min, he2min, he3min };
}

function normalizeExtraBuckets(item = {}) {
  const he1 = Number(item.he1min || 0);
  const he2 = Number(item.he2min || 0);
  const he3 = Number(item.he3min || 0);
  if (!item.heBucketsExplicit && he1 > 120 && he2 === 0 && he3 === 0) return { ...item, ...splitExtraHours(he1) };
  return item;
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
  const normalizedItems = items.map(normalizeExtraBuckets);
  const summary = summarizeDay(normalizedItems);
  const totalHEmin = normalizedItems.reduce((sum, item) => sum + Number(item.he1min || 0) + Number(item.he2min || 0) + Number(item.he3min || 0), 0);
  const standardFor = item => Number(item.padraoCadastradoMin ?? item.padraoMin ?? item.metaDiaMin ?? item.extraNormalPadrao ?? 0) || 0;
  const metaDiaMin = normalizedItems.reduce((sum, item) => sum + Math.max(0, standardFor(item)), 0);
  const heDentroPadraoMin = normalizedItems.reduce((sum, item) => { const he = Number(item.he1min || 0) + Number(item.he2min || 0) + Number(item.he3min || 0); return sum + Math.min(he, Math.max(0, standardFor(item))); }, 0);
  const compactItem = item => {
    const { rastreio, paradasRastreador, linhasEscala, batidas, ...numbersAndStatus } = item;
    return {
      ...numbersAndStatus,
      setorAtual: classifyDriverSector(item),
      evidenciaRastreador: Array.isArray(item.evidenciaRastreador) ? item.evidenciaRastreador.slice(0, 20).map(evidence => ({ horario: evidence.horario || '', diferencaMin: evidence.diferencaMin ?? null, status: evidence.status || 'sem-evidencia', motivo: evidence.motivo || '' })) : [],
      ...(item.resumoRastreador ? { resumoRastreador: { total: Number(item.resumoRastreador.total) || 0, novas: Number(item.resumoRastreador.novas) || 0, possiveisTransitos: Number(item.resumoRastreador.possiveisTransitos) || 0, confirmadas: Number(item.resumoRastreador.confirmadas) || 0 } } : {})
    };
  };
  return { dateKey, source, updatedAt: new Date().toISOString(), summary: { ...summary, totalHEmin, metaDiaMin, excedenteVsMetaMin: totalHEmin - metaDiaMin, heDentroPadraoMin, heAcimaPadraoMin: Math.max(totalHEmin - heDentroPadraoMin, 0), registros: normalizedItems.length }, items: normalizedItems.map(compactItem) };
}
