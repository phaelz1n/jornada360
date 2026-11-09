import { durationFromPairs } from './time-utils.js';

const JORNADA_7320_NOMES = new Set([
  'JOSUE WEBER GIENDRUCZAK',
  'PAULO RAFAEL DA SILVA VARGAS',
  'VINICIUS ROSA DA CUNHA',
  'RODRIGO MARTINS DA SILVA',
  'DIEGO KNEVITZ OLIVEIRA',
  'WAGNER LUIS MACIEL VARGAS',
  'ROMULO CAVALCANTE BARCELOS'
]);

export function normalizeDriverName(name) {
  return String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleUpperCase('pt-BR');
}

function jornadaEspecial7320(nome, dateKey) {
  const [year, month, day] = String(dateKey || '').split('-').map(Number);
  if (!year || !month || !day) return null;
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday >= 1 && weekday <= 6 && JORNADA_7320_NOMES.has(normalizeDriverName(nome))
    ? ['08:00', '12:00', '13:20', '16:40']
    : null;
}

export function driverToStandardRow(driver = {}, dateKey = '') {
  const horarios = jornadaEspecial7320(driver.nome || driver.motorista, dateKey)
    || (Array.isArray(driver.horarios) ? driver.horarios.filter(Boolean).map(value => String(value).trim()).filter(Boolean) : []);
  return {
    motorista: String(driver.nome || driver.motorista || '').trim(),
    extraNormalPadrao: Math.max(0, Number(driver.extraNormalPadrao ?? driver.extraPrevistaMin ?? 0) || 0),
    horarios
  };
}

export function mergeDriverStandardRows(drivers = [], standardRows = []) {
  const driverList = Array.isArray(drivers) ? drivers : Object.values(drivers || {});
  const standardList = Array.isArray(standardRows) ? standardRows : Object.values(standardRows || {});
  const merged = new Map(driverList.filter(driver => driver?.nome).map(driver => [normalizeDriverName(driver.nome), { ...driver }]));
  standardList.filter(row => row?.motorista).forEach(row => {
    const key = normalizeDriverName(row.motorista);
    const current = merged.get(key) || { nome: String(row.motorista).trim(), setor: 'Sem setor' };
    merged.set(key, { ...current, horarios: Array.isArray(row.horarios) ? row.horarios.filter(Boolean) : [], extraNormalPadrao: Math.max(0, Number(row.extraNormalPadrao) || 0), padraoStatus: row.horarios?.length >= 2 ? 'completo' : 'pendente' });
  });
  return [...merged.values()];
}

export function applyDriverStandard(item = {}, driver = {}) {
  const standard = driverToStandardRow(driver, item.dateKey);
  if (!standard.horarios.length) return { ...item, padraoStatus: 'sem_cadastro', semHorarioPadrao: true };
  const actual = durationFromPairs(item.batidas || []);
  const expected = durationFromPairs(standard.horarios);
  const hasReportedExtra = item.heBucketsExplicit === true && ['totalHE', 'he1min', 'he2min', 'he3min', 'excedenteMin'].some(field => item[field] != null);
  const reportedBuckets = Number(item.he1min || 0) + Number(item.he2min || 0) + Number(item.he3min || 0);
  const reportedExtra = hasReportedExtra && item.heBucketsExplicit === true && reportedBuckets > 0
    ? reportedBuckets
    : Number(item.totalHE ?? item.he1min ?? item.excedenteMin ?? 0) || reportedBuckets;
  const calculatedExtra = actual != null && expected != null ? Math.max(0, actual - expected) : null;
  const extra = hasReportedExtra
    ? Math.max(0, reportedExtra)
    : calculatedExtra != null ? calculatedExtra : reportedExtra;
  const buckets = splitExtraHours(extra);
  return { ...item, padraoStatus: 'encontrado', semHorarioPadrao: false, jornadaPrevistaMin: expected, padraoCadastradoMin: standard.extraNormalPadrao, metaDiaMin: standard.extraNormalPadrao, padraoHorarios: standard.horarios, batidasExtraMin: extra, extraCalculadaPelasBatidas: actual != null && expected != null, totalHE: extra, excedenteMin: extra, ...buckets, heBucketsExplicit: true, heDentroPadraoMin: Math.min(extra, Math.max(0, standard.extraNormalPadrao)), heAcimaPadraoMin: Math.max(0, extra - Math.max(0, standard.extraNormalPadrao)) };
}

export function classifyDriverSector(item = {}, cadastro = {}) {
  const name = normalizeDriverName(item.motorista || item.nome);
  return cadastro[name]?.setor || item.setorAtual || item.setor || 'Sem setor';
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

const asArray = value => Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : [];

export function summarizeDay(items = [], cadastro = {}) {
  return asArray(items).reduce((summary, item) => {
    summary.registros += 1;
    summary.he1min += Number(item.he1min || 0);
    summary.he2min += Number(item.he2min || 0);
    summary.he3min += Number(item.he3min || 0);
    if (item.interjornada) summary.interjornada += 1;
    if (item.intrajornada || item.intraJornada || item.temLacuna) summary.intrajornada += 1;
    const setor = classifyDriverSector(item, cadastro);
    summary.porSetor[setor] = (summary.porSetor[setor] || 0) + 1;
    return summary;
  }, { registros: 0, he1min: 0, he2min: 0, he3min: 0, interjornada: 0, intrajornada: 0, porSetor: {} });
}

export function prepareProcessedDay({ dateKey, items = [], source = 'importacao', cadastro = {} }) {
  const normalizedItems = asArray(items).map(normalizeExtraBuckets);
  const summary = summarizeDay(normalizedItems, cadastro);
  const totalHEmin = normalizedItems.reduce((sum, item) => sum + Number(item.he1min || 0) + Number(item.he2min || 0) + Number(item.he3min || 0), 0);
  const standardFor = item => Number(item.padraoCadastradoMin ?? item.padraoMin ?? item.metaDiaMin ?? item.extraNormalPadrao ?? 0) || 0;
  const metaDiaMin = normalizedItems.reduce((sum, item) => sum + Math.max(0, standardFor(item)), 0);
  const heDentroPadraoMin = normalizedItems.reduce((sum, item) => { const he = Number(item.he1min || 0) + Number(item.he2min || 0) + Number(item.he3min || 0); return sum + Math.min(he, Math.max(0, standardFor(item))); }, 0);
  const compactItem = item => {
    const { rastreio, paradasRastreador, linhasEscala, ...numbersAndStatus } = item;
    return {
      ...numbersAndStatus,
      setorAtual: classifyDriverSector(item, cadastro),
      evidenciaRastreador: Array.isArray(item.evidenciaRastreador) ? item.evidenciaRastreador.slice(0, 20).map(evidence => ({ horario: evidence.horario || '', escalaHorario: evidence.escalaHorario || '', linhaEscala: evidence.linhaEscala || '', diferencaMin: evidence.diferencaMin ?? null, status: evidence.status || 'sem-evidencia', motivo: evidence.motivo || '' })) : [],
      ...(item.resumoRastreador ? { resumoRastreador: { total: Number(item.resumoRastreador.total) || 0, novas: Number(item.resumoRastreador.novas) || 0, possiveisTransitos: Number(item.resumoRastreador.possiveisTransitos) || 0, confirmadas: Number(item.resumoRastreador.confirmadas) || 0 } } : {})
    };
  };
  return { dateKey, source, updatedAt: new Date().toISOString(), summary: { ...summary, totalHEmin, metaDiaMin, excedenteVsMetaMin: totalHEmin - metaDiaMin, heDentroPadraoMin, heAcimaPadraoMin: Math.max(totalHEmin - heDentroPadraoMin, 0), registros: normalizedItems.length }, items: normalizedItems.map(compactItem) };
}
