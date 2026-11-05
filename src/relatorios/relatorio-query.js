import { applyDriverStandard, summarizeDay, splitExtraHours, classifyDriverSector, normalizeDriverName } from '../processamento/processamento-model.js';
import { isCoverageSector } from '../processamento/sector-rules.js';

const asArray = value => Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : [];

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

function outsideScheduleTimes(item = {}) {
  const punches = Array.isArray(item.batidas) ? item.batidas : [];
  const standard = Array.isArray(item.padraoHorarios) ? item.padraoHorarios : [];
  const clock = value => { const match = String(value ?? '').match(/(\d{1,2}):(\d{2})/); return match ? Number(match[1]) * 60 + Number(match[2]) : null; };
  const expected = standard.map(clock).filter(value => value != null);
  return punches.filter(punch => { const minute = clock(punch); if (minute == null || !expected.length) return false; const distance = expected.reduce((best, target) => Math.min(best, Math.abs(minute - target), Math.abs(minute + 1440 - target), Math.abs(minute - target - 1440)), Infinity); return distance > 15; });
}

function normalizeItem(item = {}, cadastro = {}) {
  const driver = cadastro[normalizeDriverName(item.motorista || item.nome)];
  const sector = item.setorAtual || item.setor || item.categoria || driver?.setor || driver?.categoria || 'Sem setor';
  const withStandard = !isCoverageSector(sector) && driver?.horarios?.length >= 2 ? applyDriverStandard(item, driver) : item;
  const total = minutes(withStandard.totalHE ?? withStandard.excedenteMin ?? withStandard.he1min) || 0;
  const buckets = withStandard.heBucketsExplicit || withStandard.he2min || withStandard.he3min
    ? { he1min: Number(withStandard.he1min || 0), he2min: Number(withStandard.he2min || 0), he3min: Number(withStandard.he3min || 0) }
    : splitExtraHours(total);
  const he3min = isFeriadoOuDsr(withStandard) ? Math.max(buckets.he3min, total) : buckets.he3min;
  return { ...withStandard, ...buckets, he3min, horariosForaPadrao: outsideScheduleTimes(withStandard), setorAtual: sector, setor: sector, feriadoOuDsr: isFeriadoOuDsr(withStandard) };
}

function applyFilters(items, filters = {}) {
  const name = String(filters.motorista || '').trim().toLocaleLowerCase('pt-BR');
  const total = item => Number(item.he1min || 0) + Number(item.he2min || 0) + Number(item.he3min || 0);
  const meta = item => Number(item.padraoCadastradoMin ?? item.metaDiaMin ?? item.padraoMin ?? item.extraNormalPadrao ?? 0) || 0;
  const rastreioDivergente = item => item.rastreadorStatus === 'divergente' || item.statusCruzamento === 'divergente' || (Array.isArray(item.rastreiosForaDaEscala) && item.rastreiosForaDaEscala.length > 0);
  const foraDoPadrao = item => !isCoverageSector(item.setorAtual || item.setor || item.categoria) && total(item) > 0 && (Number(item.heAcimaPadraoMin) > 0 || (meta(item) >= 0 && total(item) > meta(item)));
  return items.filter(item => {
    const category = filters.categoria;
    const categoryKey = normalizeDriverName(category);
    const categoryMatch = !category || categoryKey === 'TODOS' || (categoryKey === 'HE.1' && item.he1min > 0) || (categoryKey === 'HE.2' && item.he2min > 0) || (categoryKey === 'HE.3' && item.he3min > 0) || (categoryKey === 'INTERJORNADA' && item.interjornada) || (categoryKey === 'INTRAJORNADA' && (item.intrajornada || item.intraJornada || item.temLacuna)) || (categoryKey === 'RASTREIO DIVERGENTE' && rastreioDivergente(item)) || (categoryKey === 'FORA DO PADRAO' && foraDoPadrao(item));
    return (!filters.setor || filters.setor === 'Todos' || item.setorAtual === filters.setor) && (!name || String(item.motorista || '').toLocaleLowerCase('pt-BR').includes(name)) && categoryMatch;
  });
}

function buildResult(items, days, forcedMetaDiaMin = null, cadastro = {}) {
  const normalized = asArray(items).map(item => normalizeItem(item, cadastro));
  const summary = summarizeDay(normalized);
  const totalHEmin = normalized.reduce((total, item) => total + item.he1min + item.he2min + item.he3min, 0);
  const dailyMeta = new Map();
  normalized.forEach(item => {
    const key = item.dateKey || 'sem-data';
    dailyMeta.set(key, (dailyMeta.get(key) || 0) + Math.max(0, minutes(item.metaDiaMin) || 0));
  });
  const totalMetaLoaded = [...dailyMeta.values()].reduce((total, value) => total + value, 0);
  const metaDays = Math.max(dailyMeta.size, days || 1);
  const metaMediaDiariaMin = forcedMetaDiaMin == null ? Math.round(totalMetaLoaded / metaDays) : Math.max(0, minutes(forcedMetaDiaMin) || 0);
  const metaPeriodoMin = forcedMetaDiaMin == null ? metaMediaDiariaMin * metaDays : metaMediaDiariaMin;
  const metaDiaMin = metaPeriodoMin;
  const metaIndividual = item => {
    const value = minutes(item.padraoCadastradoMin ?? item.padraoMin ?? item.padraoMetaMin ?? item.metaPadraoMin ?? item.padraoCadastrado ?? item.extraNormalPadrao);
    const hasRegisteredSchedule = item.padraoStatus === 'encontrado' || (Array.isArray(item.padraoHorarios) && item.padraoHorarios.length >= 2);
    return value != null && (value > 0 || hasRegisteredSchedule) ? Math.max(0, value) : null;
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
  return { items: normalized, summary: { ...summary, registros: normalized.length, colaboradores: names.size, totalHEmin, foraPadraoAuditoriaMin: heAcimaPadraoMin, metaDiaMin, metaMediaDiariaMin, metaPeriodoMin, diasComMeta: dailyMeta.size, excedenteVsMetaMin: totalHEmin - metaPeriodoMin, heDentroPadraoMin, heAcimaPadraoMin, semPadraoMin, motoristasComHE: driversWithHE.size, motoristasSemPadrao: driversWithoutStandard.size, mediaPorOcorrenciaMin, maxPorOcorrenciaMin: occurrences.at(-1) || 0, porSetorDetalhado: bySector }, porMotorista: [...names.values()], porSetor: summary.porSetor, diasProcessados: days };
}

export function consultarDia(snapshots = [], dateKey, filters = {}, cadastro = {}) {
  const snapshotList = asArray(snapshots);
  const snapshot = snapshotList.find(item => item?.dateKey === dateKey);
  const items = applyFilters(asArray(snapshot?.items).map(item => ({ ...item, dateKey })), filters);
  const result = buildResult(items, snapshot ? 1 : 0, filters.metaDiaMin, cadastro);
  return result;
}

export function consultarPeriodo(snapshots = [], competencia, filters = {}, cadastro = {}) {
  const selected = asArray(snapshots).filter(item => item?.dateKey >= competencia.inicio && item?.dateKey <= competencia.fim);
  const items = applyFilters(selected.flatMap(snapshot => asArray(snapshot.items).map(item => ({ ...item, dateKey: snapshot.dateKey }))), filters);
  return buildResult(items, selected.length, filters.metaDiaMin, cadastro);
}
