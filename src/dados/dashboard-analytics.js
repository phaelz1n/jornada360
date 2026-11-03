const BUCKETS = ['he1min', 'he2min', 'he3min'];
const RISK_KEYS = ['interjornada', 'intrajornada', 'foraDaEscala', 'semPadrao', 'rastreioDivergente'];

const finite = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const totalHE = item => BUCKETS.reduce((sum, bucket) => sum + Math.max(0, finite(item?.[bucket])), 0);
const positiveMeta = item => Math.max(0, finite(item?.metaDiaMin ?? item?.padraoCadastradoMin ?? item?.padraoMin));

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

function buildDashboardAnalytics({ report = {}, snapshots = [] } = {}) {
  const snapshotItems = snapshots.flatMap(snapshot => (snapshot.items || []).map(item => ({ ...item, dateKey: item.dateKey || snapshot.dateKey })));
  const items = (report.items || []).length && (report.items || []).every(item => item.dateKey)
    ? report.items.map(item => ({ ...item }))
    : snapshotItems;
  const bucketComposition = BUCKETS.reduce((result, bucket) => {
    result[bucket] = items.reduce((sum, item) => sum + Math.max(0, finite(item[bucket])), 0);
    return result;
  }, { he1min: 0, he2min: 0, he3min: 0 });
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
  items.forEach(item => {
    if (item.interjornada || item.interjornadaProblema) riskMatrix.interjornada += 1;
    if (item.intrajornada || item.intraJornada || item.temLacuna || item.intervaloObrigatorioAusente) riskMatrix.intrajornada += 1;
    if (item.foraDaEscalaProblema) riskMatrix.foraDaEscala += 1;
    if (item.semHorarioPadrao || item.padraoStatus === 'sem_cadastro') riskMatrix.semPadrao += 1;
    if (item.rastreadorStatus === 'divergente') riskMatrix.rastreioDivergente += 1;
  });

  return {
    dailySeries: dailySeries(items),
    bucketComposition,
    driverDistribution: [...drivers.values()].sort((a, b) => b.totalHEmin - a.totalHEmin || a.motorista.localeCompare(b.motorista)),
    sectorComparison: [...sectors.values()].sort((a, b) => b.totalHEmin - a.totalHEmin || a.setor.localeCompare(b.setor)),
    riskMatrix
  };
}

export { buildDashboardAnalytics };
