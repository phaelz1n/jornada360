const BUCKETS = ['he1min', 'he2min', 'he3min'];
const RISK_KEYS = ['interjornada', 'intrajornada', 'foraDaEscala', 'semPadrao', 'rastreioDivergente'];

const finite = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const totalHE = item => BUCKETS.reduce((sum, bucket) => sum + Math.max(0, finite(item?.[bucket])), 0);
const positiveMeta = item => Math.max(0, finite(item?.metaDiaMin ?? item?.padraoCadastradoMin ?? item?.padraoMin));
const hasStandard = item => item?.padraoStatus === 'encontrado' || (Array.isArray(item?.padraoHorarios) && item.padraoHorarios.length >= 2);
const normalizeName = value => String(value || '').trim().replace(/\s+/g, ' ').toLocaleUpperCase('pt-BR');
const previousDate = dateKey => { const date = new Date(`${dateKey}T12:00:00`); date.setDate(date.getDate() - 1); return date.toISOString().slice(0, 10); };
const asArray = value => Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : [];

export function groupPeopleBySector(items = []) {
  const groups = new Map();
  asArray(items).forEach(item => {
    const setor = item.setorAtual || item.setor || 'Sem setor';
    const people = groups.get(setor) || new Map();
    const name = item.motorista || 'Sem motorista';
    const person = people.get(name) || { motorista: name, totalHEmin: 0, he1min: 0 };
    person.he1min += Math.max(0, finite(item.he1min));
    person.totalHEmin += totalHE(item);
    people.set(name, person);
    groups.set(setor, people);
  });
  return new Map([...groups].map(([sector, people]) => [sector, [...people.values()].sort((a, b) => b.totalHEmin - a.totalHEmin || a.motorista.localeCompare(b.motorista))]));
}


function dailySeries(items) {
  const days = new Map();
  items.forEach(item => {
    const dateKey = item.dateKey || 'sem-data';
    const row = days.get(dateKey) || { dateKey, totalHEmin: 0, he1min: 0, he2min: 0, he3min: 0, dentroPadraoMin: 0, acimaPadraoMin: 0, metaMin: 0 };
    const total = totalHE(item);
    const meta = positiveMeta(item);
    row.totalHEmin += total;
    row.he1min += Math.max(0, finite(item.he1min));
    row.he2min += Math.max(0, finite(item.he2min));
    row.he3min += Math.max(0, finite(item.he3min));
    row.metaMin += meta;
    row.dentroPadraoMin += Math.min(total, meta);
    row.acimaPadraoMin += Math.max(total - meta, 0);
    days.set(dateKey, row);
  });
  return [...days.values()].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

function buildDashboardAnalytics({ report = {}, snapshots = [], motoristas = [] } = {}) {
  const snapshotList = asArray(snapshots);
  const driverList = asArray(motoristas);
  const snapshotItems = snapshotList.flatMap(snapshot => asArray(snapshot.items).map(item => ({ ...item, dateKey: item.dateKey || snapshot.dateKey })));
  const cadastro = new Map(driverList.map(driver => [normalizeName(driver.nome), driver.setor || driver.categoria]).filter(([, setor]) => setor));
  const reportItems = asArray(report.items);
  const sourceItems = reportItems.length && (reportItems.every(item => item.dateKey) || !snapshotItems.length) ? reportItems : snapshotItems;
  const items = sourceItems.map(item => ({
    ...item,
    ...(cadastro.get(normalizeName(item.motorista || item.nome)) ? { setorAtual: cadastro.get(normalizeName(item.motorista || item.nome)) } : {})
  }));
  const bucketComposition = BUCKETS.reduce((result, bucket) => {
    result[bucket] = items.reduce((sum, item) => sum + Math.max(0, finite(item[bucket])), 0);
    return result;
  }, { he1min: 0, he2min: 0, he3min: 0 });
  bucketComposition.semPadraoMin = items.reduce((sum, item) => sum + (hasStandard(item) || positiveMeta(item) > 0 ? 0 : totalHE(item)), 0);
  bucketComposition.totalHEmin = BUCKETS.reduce((sum, bucket) => sum + bucketComposition[bucket], 0);

  const drivers = new Map();
  const sectors = new Map();
  items.forEach(item => {
    const motorista = item.motorista || 'Sem motorista';
    const driver = drivers.get(motorista) || { motorista, totalHEmin: 0, he1min: 0, he2min: 0, he3min: 0, ocorrencias: 0 };
    BUCKETS.forEach(bucket => { driver[bucket] += Math.max(0, finite(item[bucket])); });
    driver.totalHEmin += totalHE(item);
    driver.ocorrencias += totalHE(item) > 0 ? 1 : 0;
    drivers.set(motorista, driver);
    const setor = item.setorAtual || item.setor || 'Sem setor';
    const sector = sectors.get(setor) || { setor, totalHEmin: 0, he1min: 0, he2min: 0, he3min: 0, dentroPadraoMin: 0, acimaPadraoMin: 0 };
    BUCKETS.forEach(bucket => { sector[bucket] += Math.max(0, finite(item[bucket])); });
    const total = totalHE(item);
    const meta = positiveMeta(item);
    sector.totalHEmin += total;
    sector.dentroPadraoMin += Math.min(total, meta);
    sector.acimaPadraoMin += Math.max(total - meta, 0);
    sectors.set(setor, sector);
  });

  const riskMatrix = RISK_KEYS.reduce((result, key) => { result[key] = 0; return result; }, {});
  const riskDetails = RISK_KEYS.reduce((result, key) => { result[key] = new Set(); return result; }, {});
  const snapshotByDate = new Map(snapshotList.map(snapshot => [snapshot.dateKey, snapshot]));
  const riskEvidence = RISK_KEYS.reduce((result, key) => { result[key] = []; return result; }, {});
  items.forEach(item => {
    const name = item.motorista || 'Sem motorista';
    const risks = {
      interjornada: item.interjornada || item.interjornadaProblema,
      intrajornada: item.intrajornada || item.intraJornada || item.temLacuna || item.intervaloObrigatorioAusente,
      foraDaEscala: item.foraDaEscalaProblema,
      semPadrao: !hasStandard(item) && (item.semHorarioPadrao || item.padraoStatus === 'sem_cadastro' || (positiveMeta(item) <= 0 && totalHE(item) > 0)),
      rastreioDivergente: item.rastreadorStatus === 'divergente'
    };
    Object.entries(risks).forEach(([key, active]) => { if (active) riskDetails[key].add(name); });
    Object.entries(risks).forEach(([key, active]) => {
      if (!active) return;
      const previous = key === 'interjornada' && item.dateKey ? snapshotByDate.get(previousDate(item.dateKey)) : null;
      const previousItem = asArray(previous?.items).find(candidate => normalizeName(candidate.motorista || candidate.nome) === normalizeName(name));
      riskEvidence[key].push({ motorista: name, dateKey: item.dateKey || null, batidas: item.batidas || [], ...(key === 'interjornada' ? { previousDateKey: previous?.dateKey || previousDate(item.dateKey), previousBatidas: previousItem?.batidas || [] } : {}) });
    });
  });

  return {
    dailySeries: dailySeries(items),
    bucketComposition,
    driverDistribution: [...drivers.values()].sort((a, b) => b.totalHEmin - a.totalHEmin || a.motorista.localeCompare(b.motorista)),
    sectorComparison: [...sectors.values()].sort((a, b) => b.totalHEmin - a.totalHEmin || a.setor.localeCompare(b.setor)),
    riskMatrix: RISK_KEYS.reduce((result, key) => { result[key] = riskDetails[key].size; return result; }, {}),
    riskDetails: RISK_KEYS.reduce((result, key) => { result[key] = [...riskDetails[key]].sort((a, b) => a.localeCompare(b)); return result; }, {}),
    riskEvidence
  };
}

export { buildDashboardAnalytics };
