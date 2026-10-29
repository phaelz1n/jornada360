import { summarizeDay, splitExtraHours, classifyDriverSector, normalizeDriverName } from '../processamento/processamento-model.js';

function isFeriadoOuDsr(item) {
  return Boolean(item.feriado || item.dsr || item.isFeriado || item.isDsr || item.tipoDia === 'FERIADO' || item.tipoDia === 'DSR' || item.classificacao === 'FERIADO' || item.classificacao === 'DSR');
}

function normalizeItem(item = {}) {
  const total = Number(item.totalHE ?? item.excedenteMin ?? item.he1min ?? 0) || 0;
  const buckets = item.he2min || item.he3min ? { he1min: Number(item.he1min || 0), he2min: Number(item.he2min || 0), he3min: Number(item.he3min || 0) } : splitExtraHours(total);
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
  const metaDiaMin = forcedMetaDiaMin == null ? normalized.reduce((total, item) => total + Number(item.metaDiaMin || 0), 0) : Number(forcedMetaDiaMin) || 0;
  const metaIndividual = item => item.padraoCadastradoMin ?? item.padraoMetaMin ?? item.metaPadraoMin;
  const standardItems = normalized.filter(item => metaIndividual(item) != null && Number.isFinite(Number(metaIndividual(item))));
  const heDentroPadraoMin = standardItems.reduce((total, item) => total + Math.min(item.he1min + item.he2min + item.he3min, Number(metaIndividual(item))), 0);
  const heAcimaPadraoMin = standardItems.reduce((total, item) => total + Math.max(item.he1min + item.he2min + item.he3min - Number(metaIndividual(item)), 0), 0);
  const driversWithHE = new Set(normalized.filter(item => item.he1min + item.he2min + item.he3min > 0).map(item => normalizeDriverName(item.motorista)));
  const driversWithoutStandard = new Set(normalized.filter(item => item.he1min + item.he2min + item.he3min > 0 && metaIndividual(item) == null).map(item => normalizeDriverName(item.motorista)));
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
  return { items: normalized, summary: { ...summary, colaboradores: names.size, totalHEmin, metaDiaMin, excedenteVsMetaMin: totalHEmin - metaDiaMin, heDentroPadraoMin, heAcimaPadraoMin, motoristasComHE: driversWithHE.size, motoristasSemPadrao: driversWithoutStandard.size }, porMotorista: [...names.values()], porSetor: summary.porSetor, diasProcessados: days };
}

export function consultarDia(snapshots = [], dateKey, filters = {}) {
  const snapshot = snapshots.find(item => item?.dateKey === dateKey);
  const items = applyFilters((snapshot?.items || []).map(item => ({ ...item, dateKey })), filters);
  return buildResult(items, snapshot ? 1 : 0, filters.metaDiaMin);
}

export function consultarPeriodo(snapshots = [], competencia, filters = {}) {
  const selected = snapshots.filter(item => item?.dateKey >= competencia.inicio && item?.dateKey <= competencia.fim);
  const items = applyFilters(selected.flatMap(snapshot => (snapshot.items || []).map(item => ({ ...item, dateKey: snapshot.dateKey }))), filters);
  return buildResult(items, selected.length, filters.metaDiaMin);
}
