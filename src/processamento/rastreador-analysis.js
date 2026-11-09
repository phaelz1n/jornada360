function timeToMinutes(value) {
  const match = String(value ?? '').match(/^(\d{1,2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function dateFromValue(value) {
  const text = String(value ?? '');
  const iso = text.match(/(\d{4})[-\/](\d{2})[-\/](\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const brazilian = text.match(/(\d{2})[-\/](\d{2})[-\/](\d{4})/);
  return brazilian ? `${brazilian[3]}-${brazilian[2]}-${brazilian[1]}` : '';
}

function scaleTimes(value) {
  const matches = String(value ?? '').match(/\d{1,2}:\d{2}/g) || [];
  return { inicio: timeToMinutes(matches[0]), fim: timeToMinutes(matches[1] || matches[0]) };
}

function normalizeStops(rastreador = {}) {
  const source = rastreador.paradas || rastreador.stops || [];
  const stops = source.map(stop => ({
    horario: stop.horario || stop.hora || stop.time || '',
    dataKey: stop.dataKey || '',
    minuto: timeToMinutes(stop.horario || stop.hora || stop.time),
    duracaoMin: Number(stop.duracaoMin ?? stop.duracao ?? 0) || 0,
    local: stop.local || stop.endereco || stop.address || '',
    endereco: stop.endereco || stop.local || stop.address || '',
    tipo: stop.tipo || stop.type || '',
    link: stop.link || stop.url || ''
  }));
  const departures = (rastreador.trajetos || []).map(trajeto => ({
    horario: String(trajeto.partida || trajeto.dataHoraPartida || '').match(/\d{1,2}:\d{2}/)?.[0] || '',
    dataKey: dateFromValue(trajeto.partida || trajeto.dataHoraPartida),
    duracaoMin: 0,
    local: trajeto.local || '',
    endereco: trajeto.endereco || '',
    tipo: 'partida',
    link: trajeto.link || ''
  }));
  return [...stops, ...departures].map(stop => ({
    ...stop,
    minuto: timeToMinutes(stop.horario)
  })).filter(stop => stop.minuto != null);
}

function normalizeScale(escala = []) {
  return escala.map(row => ({
    ...row,
    ...scaleTimes(row.horario),
    inicioMin: timeToMinutes(row.inicio || row.horarioInicio) ?? scaleTimes(row.horario).inicio,
    fimMin: timeToMinutes(row.fim || row.horarioFim) ?? scaleTimes(row.horario).fim
  })).filter(row => row.inicioMin != null);
}

function closestDistance(minute, scale) {
  if (scale.fimMin == null) return Math.abs(minute - scale.inicioMin);
  if (scale.fimMin < scale.inicioMin) {
    const normalizedMinute = minute < scale.inicioMin ? minute + 1440 : minute;
    const normalizedEnd = scale.fimMin + 1440;
    if (normalizedMinute >= scale.inicioMin && normalizedMinute <= normalizedEnd) return 0;
    return Math.min(Math.abs(normalizedMinute - scale.inicioMin), Math.abs(normalizedMinute - normalizedEnd));
  }
  if (minute >= scale.inicioMin && minute <= scale.fimMin) return 0;
  return Math.min(Math.abs(minute - scale.inicioMin), Math.abs(minute - scale.fimMin));
}

export function analisarParadasRastreador({ batidas = [], escala = [], rastreador = {}, paradasConhecidas = [], toleranciaMin = 15 } = {}) {
  const scale = normalizeScale(escala);
  const stops = normalizeStops(rastreador);
  const punches = batidas.map(timeToMinutes).filter(value => value != null);
  const known = paradasConhecidas.map(stop => ({ ...stop, minuto: timeToMinutes(stop.horario) }));
  const paradas = stops.map(stop => {
    const match = scale.map(row => ({ row, distance: closestDistance(stop.minuto, row) })).sort((a, b) => a.distance - b.distance)[0];
    const inWindow = Boolean(match && match.distance <= toleranciaMin);
    const foraDaEscala = Boolean(scale.length && match && match.distance > toleranciaMin);
    const knownMatch = known.some(item => (item.local && item.local.toLocaleLowerCase() === stop.local.toLocaleLowerCase()) || (item.minuto != null && Math.abs(item.minuto - stop.minuto) <= toleranciaMin));
    const outsidePunch = Boolean(match && match.row.fimMin != null && stop.minuto > match.row.fimMin + toleranciaMin && punches.some(punch => punch > match.row.fimMin + toleranciaMin));
    let status = 'nova';
    let motivo = foraDaEscala ? 'fora-da-escala' : 'parada-nao-cadastrada';
    if (inWindow) { status = 'confirmada'; motivo = 'escala-e-rastreador-confirmam'; }
    else if (outsidePunch) { status = 'possivel-transito'; motivo = 'escala-e-rastreador-confirmam'; }
    else if (knownMatch) { status = 'normal'; motivo = 'parada-conhecida'; }
    const diferencaMin = match ? (stop.minuto < match.row.inicioMin ? match.row.inicioMin - stop.minuto : stop.minuto - match.row.inicioMin) : null;
    return { ...stop, status, motivo, foraDaEscala, linha: match?.row.linha || match?.row.nome || '', escalaHorario: match?.row.horario || '', diferencaMin, precisaCadastro: status === 'nova' && !foraDaEscala };
  });
  return { paradas, total: paradas.length, novas: paradas.filter(item => item.status === 'nova').length, possiveisTransitos: paradas.filter(item => item.status === 'possivel-transito').length, confirmadas: paradas.filter(item => item.status === 'confirmada').length };
}
