export function createInitialReportState(dateKey = '') {
  return { mode: 'dia', dateKey, periodKey: '', motorista: '', setor: 'Todos', categoria: 'Todos' };
}

export function updateReportFilter(state, patch) {
  return { ...state, ...patch };
}
