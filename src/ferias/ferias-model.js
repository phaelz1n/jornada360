const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDate(value) {
  if (value instanceof Date) return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  const text = String(value || '').trim();
  const br = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return new Date(Date.UTC(Number(br[3]), Number(br[2]) - 1, Number(br[1])));
  const iso = text.match(DATE_PATTERN);
  if (iso) return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
  return null;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

export function addCalendarDays(value, amount) {
  const date = parseDate(value);
  if (!date) return null;
  date.setUTCDate(date.getUTCDate() + Number(amount || 0));
  return formatDate(date);
}

export function businessDaysBefore(value, amount) {
  const date = parseDate(value);
  if (!date) return null;
  let remaining = Number(amount || 0);
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() - 1);
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return formatDate(date);
}

function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function numberValue(value) {
  const number = Number(String(value ?? '').replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(number) ? number : 0;
}

function normalizeDate(value) {
  const date = parseDate(value);
  return date ? formatDate(date) : null;
}

export function normalizeVacationRecord(input = {}) {
  return {
    employeeCode: normalizeText(input.employeeCode ?? input.codigo ?? input.codReg),
    employeeName: normalizeText(input.employeeName ?? input.trabalhador ?? input.nome),
    role: normalizeText(input.role ?? input.cargo ?? input.funcao),
    garageDistance: normalizeText(input.garageDistance ?? input.distanciaGaragem) || 'nao_classificado',
    balanceDays: numberValue(input.balanceDays ?? input.saldo),
    gozoLimit: normalizeDate(input.gozoLimit ?? input.limiteGozo),
    accrualPeriod: normalizeText(input.accrualPeriod ?? input.periodoAquisitivo),
    sourceImportId: normalizeText(input.sourceImportId ?? input.origem ?? input.importId)
  };
}

export function isDriverRole(role) {
  return /motorista|condutor|ferista/i.test(String(role || ''));
}

export function feristaCanCover(ferista, employee) {
  if (ferista?.coverageScope !== 'longe_garagem') return true;
  return employee?.garageDistance === 'longe';
}

function comparableEmployeeName(value) {
  return normalizeText(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function detectVacationImportConflicts(existing = [], incoming = []) {
  const conflicts = [];
  incoming.forEach(next => {
    const previous = existing.find(item => comparableEmployeeName(item.employeeName) === comparableEmployeeName(next.employeeName));
    if (!previous) return;
    const same = ['balanceDays', 'gozoLimit', 'accrualPeriod', 'startDate', 'endDate'].every(field => String(previous[field] ?? '') === String(next[field] ?? ''));
    if (same) return;
    const previousStart = parseDate(previous.startDate || previous.gozoLimit);
    const previousEnd = parseDate(previous.endDate || previous.startDate || previous.gozoLimit);
    const nextStart = parseDate(next.startDate || next.gozoLimit);
    const nextEnd = parseDate(next.endDate || next.startDate || next.gozoLimit);
    if (!previousStart || !previousEnd || !nextStart || !nextEnd) return;
    const gap = Math.min(Math.abs(nextStart - previousEnd), Math.abs(previousStart - nextEnd)) / 86400000;
    const overlaps = nextStart <= previousEnd && previousStart <= nextEnd;
    if (overlaps || gap <= 30) conflicts.push({ employeeName: next.employeeName, previous, incoming: next });
  });
  return conflicts;
}

export function validateVacationSuggestion({ today, startDate, endDate, employee = {}, shift, ferista }) {
  const errors = [];
  const minimumStart = addCalendarDays(today, 30);
  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate || addCalendarDays(start, Math.max(0, Number(employee.balanceDays || 1) - 1)));
  if (!start || !end || start < minimumStart) errors.push('antecedencia_insuficiente');
  if (employee.gozoLimit && end && end > employee.gozoLimit) errors.push('limite_gozo_excedido');
  if (!employee.balanceDays || employee.balanceDays < 1) errors.push('saldo_invalido');
  if (!shift) errors.push('turno_ausente');
  if (!ferista) errors.push('ferista_ausente');
  return { status: errors.length ? 'com_pendencias' : 'pronta', errors, startDate: start, endDate: end };
}

export function suggestVacation({ today, employee, shift, feristas = [] }) {
  const startDate = addCalendarDays(today, 30);
  const compatible = feristas.find(item => {
    const supportsShift = Array.isArray(item.shiftIds) && shift && item.shiftIds.includes(shift.id);
    const inWindow = (!item.availableFrom || startDate >= item.availableFrom) && (!item.availableTo || startDate <= item.availableTo);
    return supportsShift && item.status !== 'inativo' && inWindow && feristaCanCover(item, employee);
  }) || null;
  const base = validateVacationSuggestion({ today, startDate, employee, shift, ferista: compatible });
  const trainingStartDate = businessDaysBefore(startDate, 2);
  return {
    ...base,
    status: base.status,
    employeeCode: employee.employeeCode,
    employeeName: employee.employeeName,
    balanceDays: employee.balanceDays,
    gozoLimit: employee.gozoLimit,
    shiftId: shift?.id || null,
    feristaId: compatible?.id || null,
    trainingStartDate,
    trainingEndDate: addCalendarDays(startDate, -1),
    source: 'motor_regras'
  };
}

function overlaps(firstStart, firstEnd, secondStart, secondEnd) {
  return Boolean(firstStart && firstEnd && secondStart && secondEnd && firstStart <= secondEnd && secondStart <= firstEnd);
}

export function detectVacationConflicts(items = []) {
  const conflicts = [];
  for (let index = 0; index < items.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < items.length; nextIndex += 1) {
      const current = items[index];
      const next = items[nextIndex];
      if (current.status === 'rejeitada' || current.status === 'cancelada' || next.status === 'rejeitada' || next.status === 'cancelada') continue;
      if (current.feristaId && current.feristaId === next.feristaId && overlaps(current.trainingStartDate || current.startDate, current.endDate, next.trainingStartDate || next.startDate, next.endDate)) conflicts.push({ type: 'ferista_sobreposto', ids: [current.id, next.id], message: `Ferista ocupado em períodos sobrepostos: ${current.employeeName} e ${next.employeeName}.` });
      if (current.employeeName && current.employeeName === next.employeeName && overlaps(current.startDate, current.endDate, next.startDate, next.endDate)) conflicts.push({ type: 'funcionario_sobreposto', ids: [current.id, next.id], message: `Funcionário possui períodos sobrepostos: ${current.employeeName}.` });
    }
  }
  return conflicts;
}
