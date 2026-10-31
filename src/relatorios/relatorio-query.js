import { summarizeDay, splitExtraHours, classifyDriverSector, normalizeDriverName } from '../processamento/processamento-model.js';

function isFeriadoOuDsr(item) {
  return Boolean(item.feriado || item.dsr || item.isFeriado || item.isDsr || item.tipoDia === 'FERIADO' || item.tipoDia === 'DSR' || item.classificacao === 'FERIADO' || item.classificacao === 'DSR');
}

function minutes(value) {
  if (typeof value === 'number') return value;
  const text = String(value ?? '').trim();
  if (!text) return null;
  if (/^\d{1,3}:\d{2}$/.test(text)) {
    const [hours, mins] = text.split(':').map(Number);
    return hours * 60 + mins;
  }
  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeItem(item = {}) {
  const total = minutes(item.totalHE ?? item.excedenteMin ?? item.he1min) || 0;
  const buckets = item.heBucketsExplicit || item.he2min || item.he3min
    ? { he1min: Number(item.he1min || 0), he2min: Number(item.he2min || 0), he3min: Number(item.he3min || 0) }
    : splitExtraHours(total);
  const he3min = isFeriadoOuDsr(item) ? Math.max(buckets.he3min, total) : buckets.he3min;
  return { ...item, ...buckets, he3min, setorAtual: classifyDriverSector(item), feriadoOuDsr: isFeriadoOuDsr(item) };
}

function applyFilters(items, filters = {}) {
  const name = String(filters.motorista || '').trim().toLocaleLowerCase('pt-BR');
  return items.filter(item => (!filters.setor || filters.setor === 'Todos' || item.setorAtual === filters.setor) && (!name || String(item.motorista || '').toLocaleLowerCase('pt-BR').includes(name)) && (!filters.categoria || filters.categoria === 'Todos' || (filters.categoria === 'HE.1' && item.he1min > 0) || (filters.categoria === 'HE.2' && item.he2min > 0) || (filters.categoria === 'HE.3' && item.he3min > 0) || (filters.categoria === 'Interjornada' && item.interjornada) || (filters.categoria === 'Intrajornada' && (item.intrajornada || item.intraJornada || item.temLacuna))));
}

function buildResult(items, days, forcedMetaDiaMin = null) {
  const normalized = items.map(normalizeItem);
  const summary = summarizeDay(normalized);
  const totalHEmin = normalized.reduce((total, item) => total + item.he1min + item.he2min + item.he3min, 0);
  const dailyMeta = new Map();
  normalized.forEach(item => {
    const key = item.dateKey || 'sem-data';
    dailyMeta.set(key, (dailyMeta.get(key) || 0) + (minutes(item.metaDiaMin) || 0));
  });
  const totalMetaLoaded = [...dailyMeta.values()].reduce((total, value) => total + value, 0);
  const metaDays = Math.max(dailyMeta.size, days || 1);
  const metaMediaDiariaMin = forcedMetaDiaMin == null ? Math.round(totalMetaLoaded / metaDays) : (minutes(forcedMetaDiaMin) || 0);
  const metaPeriodoMin = forcedMetaDiaMin == null ? metaMediaDiariaMin * metaDays : metaMediaDiariaMin;
  const metaDiaMin = metaPeriodoMin;
  const metaIndividual = item => {
    const value = minutes(item.padraoCadastradoMin ?? item.padraoMin ?? item.padraoMetaMin ?? item.metaPadraoMin ?? item.padraoCadastrado ?? item.extraNormalPadrao);
    return value != null && value > 0 ? value : null;
  };
  const standardItems = normalized.filter(item => metaIndividual(item) != null);
  const heDentroPadraoMin = standardItems.reduce((total, item) => {
    const he = item.he1min + item.he2min + item.he3min;
    const meta = Math.max(0, metaIndividual(item));
    return total + Math.min(he, meta);
  }, 0);
  const heAcimaPadraoMin = standardItems.reduce((total, item) => {
    const he = item.he1min + item.he2min + item.he3min;
    const meta = metaIndividual(item);
    return total + (meta < 0 ? he : Math.max(he - meta, 0));
  }, 0);
  const semPadraoMin = normalized.filter(item => metaIndividual(item) == null).reduce((total, item) => total + item.he1min + item.he2min + item.he3min, 0);
  const driversWithHE = new Set(normalized.filter(item => item.he1min + item.he2min + item.he3min > 0).map(item => normalizeDriverName(item.motorista)));
  const driversWithoutStandard = new Set(normalized.filter(item => item.he1min + item.he2min + item.he3min > 0 && metaIndividual(item) == null).map(item => normalizeDriverName(item.motorista)));
  const occurrences = normalized.map(item => item.he1min + item.he2min + item.he3min).filter(value => value > 0).sort((a, b) => a - b);
  const mediaPorOcorrenciaMin = occurrences.length ? Math.round(occurrences.reduce((sum, value) => sum + value, 0) / occurrences.length) : 0;
  const bySector = {};
  normalized.forEach(item => {
    const sector = item.setorAtual || 'Sem setor';
    const row = bySector[sector] || { registros: 0, totalHEmin: 0, he1min: 0, dentroPadraoMin: 0, acimaPadraoMin: 0 };
    const he = item.he1min + item.he2min + item.he3min;
    row.registros += 1;
    row.totalHEmin += he;
    row.he1min += item.he1min;
    row.dentroPadraoMin += Math.min(he, Math.max(0, metaIndividual(item) ?? 0));
    row.acimaPadraoMin += metaIndividual(item) == null ? 0 : Math.max(he - Math.max(0, metaIndividual(item)), 0);
    bySector[sector] = row;
  });
  const names = new Map();
  normalized.forEach(item => {
    const key = normalizeDriverName(item.motorista);
    const current = names.get(key) || { motorista: item.motorista, setor: item.setorAtual, dias: [], he1min: 0, he2min: 0, he3min: 0, interjornada: 0, intrajornada: 0, itens: [] };
    current.dias.push(item.dateKey);
    current.he1min += item.he1min;
    current.he2min += item.he2min;
    current.he3min += item.he3min;
    current.interjornada += item.interjornada ? 1 : 0;
    current.intrajornada += item.intrajornada || item.intraJornada || item.temLacuna ? 1 : 0;
    current.itens.push(item);
    names.set(key, current);
  });
  return { items: normalized, summary: { ...summary, registros: normalized.length, colaboradores: names.size, totalHEmin, metaDiaMin, metaMediaDiariaMin, metaPeriodoMin, diasComMeta: dailyMeta.size, excedenteVsMetaMin: totalHEmin - metaPeriodoMin, heDentroPadraoMin, heAcimaPadraoMin, semPadraoMin, motoristasComHE: driversWithHE.size, motoristasSemPadrao: driversWithoutStandard.size, mediaPorOcorrenciaMin, maxPorOcorrenciaMin: occurrences.at(-1) || 0, porSetorDetalhado: bySector }, porMotorista: [...names.values()], porSetor: summary.porSetor, diasProcessados: days };
}

export function consultarDia(snapshots = [], dateKey, filters = {}) {
  const snapshot = snapshots.find(item => item?.dateKey === dateKey);
  const items = applyFilters((snapshot?.items || []).map(item => ({ ...item, dateKey })), filters);
  const result = buildResult(items, snapshot ? 1 : 0, filters.metaDiaMin);
  const hasFilters = Object.values(filters).some(value => value && value !== 'Todos');
  if (snapshot?.summary && !hasFilters) result.summary = { ...result.summary, ...snapshot.summary };
  return result;
}

export function consultarPeriodo(snapshots = [], competencia, filters = {}) {
  const selected = snapshots.filter(item => item?.dateKey >= competencia.inicio && item?.dateKey <= competencia.fim);
  const items = applyFilters(selected.flatMap(snapshot => (snapshot.items || []).map(item => ({ ...item, dateKey: snapshot.dateKey }))), filters);
  return buildResult(items, selected.length, filters.metaDiaMin);
}
