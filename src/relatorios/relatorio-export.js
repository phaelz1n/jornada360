function csvValue(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

export function formatReportTimes(value) {
  return Array.isArray(value) ? value.join(' · ') : String(value ?? '');
}

export function buildReportCsv(items = []) {
  const headers = ['Data', 'Motorista', 'Setor', 'Horários realizados', 'Horário padrão', 'HE.1 (min)', 'HE.2 (min)', 'HE.3 (min)', 'Interjornada', 'Intrajornada', 'Rastreio divergente', 'HE fora do padrão (hh:mm)', 'HE fora do padrão (horas para somar)', 'Justificativa'];
  const lines = [headers, ...items.map(item => {
    const foraMin = Number(item.heAcimaPadraoMin || 0);
    return [item.dateKey || '', item.motorista, item.setorAtual || item.setor || 'Sem setor', formatReportTimes(item.batidas), formatReportTimes(item.padraoHorarios), item.he1min || 0, item.he2min || 0, item.he3min || 0, item.interjornada ? 'Sim' : 'Não', item.intrajornada || item.intraJornada || item.temLacuna ? 'Sim' : 'Não', item.rastreadorStatus === 'divergente' ? 'Sim' : 'Não', `${String(Math.floor(foraMin / 60)).padStart(2, '0')}:${String(foraMin % 60).padStart(2, '0')}`, (foraMin / 60).toFixed(4).replace('.', ','), item.justificativa || item.justificativaSugerida || ''];
  })];
  return lines.map(row => row.map(csvValue).join(';')).join('\n');
}
