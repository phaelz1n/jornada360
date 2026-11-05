export function normalizeDriverKey(name) {
  return String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleUpperCase('pt-BR');
}

function completeness(driver = {}) {
  return (Array.isArray(driver.horarios) && driver.horarios.filter(Boolean).length >= 2 ? 4 : 0)
    + (driver.setor || driver.categoria ? 2 : 0)
    + (Number(driver.extraNormalPadrao ?? driver.extraPrevistaMin) >= 0 ? 1 : 0)
    + (driver.padraoStatus === 'completo' ? 1 : 0);
}

function mergeDriverRecords(records) {
  return records.reduce((best, current) => {
    const candidate = completeness(current) > completeness(best) ? current : best;
    const other = candidate === current ? best : current;
    return {
      ...other,
      ...candidate,
      nome: candidate.nome || other.nome,
      horarios: candidate.horarios?.length >= 2 ? candidate.horarios : other.horarios || [],
      setor: candidate.setor || candidate.categoria || other.setor || other.categoria || 'Sem setor',
      extraNormalPadrao: candidate.extraNormalPadrao ?? candidate.extraPrevistaMin ?? other.extraNormalPadrao ?? other.extraPrevistaMin ?? 0,
      padraoStatus: candidate.padraoStatus || other.padraoStatus || 'pendente'
    };
  });
}

export function mergeDuplicateDrivers(drivers = [], items = []) {
  const groups = new Map();
  [...(Array.isArray(drivers) ? drivers : Object.values(drivers || {})).map(driver => ({ ...driver, __source: 'cadastro' })), ...(Array.isArray(items) ? items : Object.values(items || {})).map(item => ({ nome: item.motorista, setor: item.setorAtual || item.setor, horarios: item.padraoHorarios || [], extraNormalPadrao: item.padraoCadastradoMin, padraoStatus: item.padraoStatus, __source: 'item' }))]
    .filter(record => String(record?.nome || '').trim())
    .forEach(record => {
      const key = normalizeDriverKey(record.nome);
      const list = groups.get(key) || [];
      list.push(record);
      groups.set(key, list);
    });
  return [...groups.entries()].map(([key, records]) => ({ key, records, driver: mergeDriverRecords(records), duplicateCount: Math.max(1, records.filter(record => record.__source === 'cadastro').length) })).sort((a, b) => a.driver.nome.localeCompare(b.driver.nome, 'pt-BR'));
}

export function findSimilarDriverNames(drivers = []) {
  const names = [...new Set((Array.isArray(drivers) ? drivers : Object.values(drivers || {})).map(driver => String(driver?.nome || '').trim()).filter(Boolean))];
  const tokens = name => normalizeDriverKey(name).split(' ').filter(Boolean);
  return names.flatMap((name, index) => names.slice(index + 1).filter(other => {
    const a = tokens(name); const b = tokens(other);
    return a.length > 1 && b.length > 1 && a[0] === b[0] && a.at(-1) === b.at(-1) && normalizeDriverKey(name) !== normalizeDriverKey(other);
  }).map(other => [name, other]));
}

export function duplicateDriverError(drivers = [], name, editingName = '') {
  const key = normalizeDriverKey(name);
  const editingKey = normalizeDriverKey(editingName);
  const existing = (Array.isArray(drivers) ? drivers : Object.values(drivers || {})).find(driver => normalizeDriverKey(driver?.nome) === key && normalizeDriverKey(driver?.nome) !== editingKey);
  return existing ? `Já existe um motorista cadastrado como “${existing.nome}”. Edite o cadastro existente para evitar duplicidade.` : '';
}
