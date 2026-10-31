import { normalizeDriverName } from './processamento-model.js';
import { analisarParadasRastreador } from './rastreador-analysis.js';

function indexByDriver(rows = []) {
  const map = new Map();
  for (const row of rows) {
    const name = normalizeDriverName(row.motorista || row.nome || row.colaborador);
    if (name) map.set(name, [...(map.get(name) || []), row]);
  }
  return map;
}

function findDriver(map, name) {
  if (map.has(name)) return map.get(name);
  const candidates = [...map.entries()].filter(([key]) => key.startsWith(name) || name.startsWith(key));
  if (candidates.length === 1) return candidates[0][1];
  const tokens = name.split(' ').filter(token => token.length > 3);
  const scored = [...map.entries()].map(([key, row]) => ({ row, score: tokens.filter(token => key.includes(token)).length })).filter(item => item.score >= Math.max(2, tokens.length - 1)).sort((a, b) => b.score - a.score);
  return scored.length === 1 || (scored[0] && scored[0].score > scored[1]?.score) ? scored[0]?.row : undefined;
}

function timeOf(value) { const match = String(value || '').match(/\d{1,2}:\d{2}/); return match ? Number(match[0].split(':')[0]) * 60 + Number(match[0].split(':')[1]) : null; }
function lineMatchesStandard(scaleRow, standardRow) {
  const scaleTime = timeOf(scaleRow?.horario || scaleRow?.inicio || scaleRow?.horarioInicio);
  return scaleTime != null && (standardRow?.horarios || []).some(value => {
    const standardTime = timeOf(value);
    return standardTime != null && Math.abs(standardTime - scaleTime) <= 15;
  });
}

function minutes(value) {
  const match = String(value || '').match(/(\d{1,2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function nextDate(dateKey) {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function isOvernightJourney(point = {}, escala = []) {
  const punches = (point.batidas || []).map(minutes).filter(value => value != null);
  if (punches.some((value, index) => index > 0 && value < punches[index - 1] - 60)) return true;
  return escala.some(row => {
    const start = minutes(row.horario || row.inicio || row.horarioInicio);
    const end = minutes(row.fim || row.horarioFim);
    return start != null && end != null && end < start;
  });
}

function analyzeIntervals(batidas = [], point = {}) {
  const punches = batidas.map(minutes).filter(value => value != null);
  const breaks = [];
  for (let index = 1; index < punches.length - 1; index += 2) {
    const next = punches[index + 1] < punches[index] ? punches[index + 1] + 1440 : punches[index + 1];
    breaks.push(Math.max(0, next - punches[index]));
  }
  const workedSpan = punches.length >= 2 ? Math.max(0, (punches.at(-1) < punches[0] ? punches.at(-1) + 1440 : punches.at(-1)) - punches[0]) : 0;
  const shortBreaks = breaks.filter(value => value < 60);
  const hasOneHourBreak = breaks.some(value => value >= 60);
  const intervalProblem = workedSpan >= 360 && breaks.length > 0 && !hasOneHourBreak;
  return {
    intervalosMin: breaks,
    intervaloMenorUmaHora: workedSpan >= 360 && shortBreaks.length > 0,
    intervaloObrigatorioAusente: intervalProblem,
    interjornadaProblema: Boolean(point.interjornada || point.interJornada || point.interjornadaStatus === 'inconsistente')
  };
}

function interjornadaFromPrevious(point = {}, previousPoint = {}) {
  const current = (point.batidas || []).map(minutes).filter(value => value != null);
  const previous = (previousPoint.batidas || []).map(minutes).filter(value => value != null);
  if (!current.length || !previous.length) return null;
  const inicioAtual = current[0];
  const fimAnterior = previous.at(-1);
  const descanso = inicioAtual + 1440 - fimAnterior;
  return descanso;
}

function buildEvidence({ batidas = [], paradaAnalysis, totalHE = 0, metaDiaMin = 0 }) {
  const stops = paradaAnalysis?.paradas || [];
  const punches = batidas.map(minutes).filter(value => value != null);
  const outside = Math.max(0, Number(totalHE) - Number(metaDiaMin));
  const evidence = punches.map(punch => {
    const nearest = stops.map(stop => ({ stop, distance: Math.abs(punch - minutes(stop.horario)) })).sort((a, b) => a.distance - b.distance)[0];
    const stop = nearest?.stop;
    const confirmed = Boolean(nearest && nearest.distance <= 15);
    return {
      horario: `${String(Math.floor(punch / 60) % 24).padStart(2, '0')}:${String(punch % 60).padStart(2, '0')}`,
      diferencaMin: nearest ? nearest.distance : null,
      status: confirmed ? 'confirmada' : 'sem-evidencia',
      motivo: confirmed ? (stop?.motivo || 'rastreio-próximo') : (stops.length ? 'nenhuma-parada-proxima' : 'sem-rastreio-no-periodo'),
      escalaHorario: stop?.escalaHorario || '',
      local: stop?.local || ''
    };
  });
  if (!evidence.length && outside > 0) evidence.push({ horario: '', diferencaMin: null, status: 'sem-evidencia', motivo: 'nenhuma-parada-proxima', local: '' });
  return { evidence, outside };
}

export function crossSources({ pointRows = [], previousPointRows = [], scaleRows = [], trackerRows = [], standardRows = [], patternHistory = {} } = {}) {
  const scale = indexByDriver(scaleRows);
  const tracker = indexByDriver(trackerRows);
  const standard = indexByDriver(standardRows);
  return pointRows.map(point => {
    const key = normalizeDriverName(point.motorista);
    const scaleRows = findDriver(scale, key) || [];
    const trackerMatch = findDriver(tracker, key);
    const rawTrackerRow = Array.isArray(trackerMatch) ? trackerMatch[0] : trackerMatch;
    const overnight = isOvernightJourney(point, scaleRows);
    const allowedDates = overnight && point.dateKey ? new Set([point.dateKey, nextDate(point.dateKey)]) : point.dateKey ? new Set([point.dateKey]) : null;
    const punches = (point.batidas || []).map(minutes).filter(value => value != null);
    const overnightEnd = overnight && punches.length ? punches[punches.length - 1] : null;
    const trackerRow = rawTrackerRow && allowedDates && Array.isArray(rawTrackerRow.paradas)
      ? { ...rawTrackerRow, paradas: rawTrackerRow.paradas.filter(stop => {
        if (stop.dataKey && !allowedDates.has(stop.dataKey)) return false;
        if (overnight && stop.dataKey === nextDate(point.dateKey) && overnightEnd != null) {
          const stopMinute = minutes(stop.horario);
          return stopMinute == null || stopMinute <= overnightEnd + 30;
        }
        return true;
      }) }
      : rawTrackerRow;
    const standardMatch = findDriver(standard, key);
    const standardRow = Array.isArray(standardMatch) ? standardMatch[0] : standardMatch;
    const previousMatch = findDriver(indexByDriver(previousPointRows), key);
    const previousPoint = Array.isArray(previousMatch) ? previousMatch[0] : previousMatch;
    const descansoInterjornadaMin = interjornadaFromPrevious(point, previousPoint || {});
    const paradaAnalysis = analisarParadasRastreador({ batidas: point.batidas || [], escala: scaleRows, rastreador: trackerRow || {} });
    const intervalAnalysis = analyzeIntervals(point.batidas || [], point);
    const matchedScale = paradaAnalysis.paradas.find(stop => stop.status === 'confirmada')?.linha
      ? scaleRows.find(row => String(row.linha || row.nome || '') === paradaAnalysis.paradas.find(stop => stop.status === 'confirmada').linha)
      : scaleRows[0];
    const rastreioCompacto = trackerRow ? {
      motorista: trackerRow.motorista,
      placa: trackerRow.placa,
      sinais: trackerRow.sinais,
      paradas: (trackerRow.paradas || []).map(stop => ({
        horario: stop.horario,
        dataHora: stop.dataHora,
        duracaoMin: stop.duracaoMin,
        local: stop.local,
        tipo: stop.tipo,
        endereco: stop.endereco,
        motoristaHerdado: stop.motoristaHerdado,
        dataKey: stop.dataKey
      }))
    } : null;
    const metaDiaMin = Number(standardRow?.extraNormalPadrao ?? 0) || 0;
    const totalHE = Number(point.totalHE ?? point.he1min ?? point.excedenteMin ?? 0) || 0;
    const trackerEvidence = buildEvidence({ batidas: point.batidas || [], paradaAnalysis, totalHE, metaDiaMin });
    const history = patternHistory?.[key] || [];
    const repeatedRealized = history.length >= 5 && history.slice(-5).every(value => Math.abs(Number(value) - totalHE) <= 5);
    const extraScaleRows = scaleRows.filter(row => !lineMatchesStandard(row, standardRow));
    const trackerExtraLine = paradaAnalysis.paradas.find(stop => extraScaleRows.some(row => {
      const scaleTime = timeOf(row.horario || row.inicio || row.horarioInicio);
      const trackerTime = timeOf(stop.horario);
      const sameLine = String(row.linha || row.nome || '').trim() && String(row.linha || row.nome || '').trim() === String(stop.linha || '').trim();
      return (sameLine && !stop.foraDaEscala) || (scaleTime != null && trackerTime != null && Math.abs(scaleTime - trackerTime) <= 30);
    }));
    const foraDaEscalaSemLinha = paradaAnalysis.paradas.find(stop => stop.foraDaEscala && !extraScaleRows.some(row => {
      const scaleTime = timeOf(row.horario || row.inicio || row.horarioInicio);
      const trackerTime = timeOf(stop.horario);
      return scaleTime != null && trackerTime != null && Math.abs(scaleTime - trackerTime) <= 30;
    }));
    return {
      ...point,
      ...intervalAnalysis,
      descansoInterjornadaMin,
      interjornadaProblema: descansoInterjornadaMin != null ? descansoInterjornadaMin < 660 : intervalAnalysis.interjornadaProblema,
      semHorarioPadrao: !standardRow,
      padraoStatus: standardRow ? 'encontrado' : 'sem_cadastro',
      ...(standardRow ? { padraoCadastradoMin: standardRow.extraNormalPadrao, metaDiaMin: standardRow.extraNormalPadrao } : {}),
      ...(standardRow ? { heDentroPadraoMin: Math.min(totalHE, metaDiaMin), heAcimaPadraoMin: Math.max(0, totalHE - metaDiaMin) } : {}),
      evidenciaRastreador: trackerEvidence.evidence,
      rastreiosForaDaEscala: paradaAnalysis.paradas.filter(stop => stop.foraDaEscala).map(stop => ({ horario: stop.horario, escalaHorario: stop.escalaHorario, diferencaMin: stop.diferencaMin, local: stop.local, motivo: stop.motivo })),
      rastreadorStatus: trackerEvidence.evidence.some(item => item.status === 'confirmada') ? 'confirmado' : trackerEvidence.evidence.length ? 'divergente' : 'sem-evidencia',
      padraoSuspeito: repeatedRealized && standardRow && totalHE > metaDiaMin,
      escalaEncontrada: scaleRows.length > 0,
      escala: matchedScale || null,
      linhasEscala: scaleRows,
      linhaExtraCandidata: Boolean(trackerExtraLine),
      linhaExtraDetalhe: trackerExtraLine ? `Possível linha extra: ${trackerExtraLine.linha || 'linha da escala'} — consta na escala de ${point.dateKey || 'do relatório'} e há rastreio compatível, mas não consta no horário padrão.` : '',
      foraDaEscalaProblema: Boolean(foraDaEscalaSemLinha),
      foraDaEscalaDetalhe: foraDaEscalaSemLinha ? `Problema para conferir: o veículo rodou às ${foraDaEscalaSemLinha.horario}, mas esse horário não bateu com nenhuma linha da escala de ${point.dateKey || 'do relatório'}.` : '',
      rastreioEncontrado: Boolean(trackerRow),
      rastreio: rastreioCompacto,
      paradasRastreador: paradaAnalysis.paradas,
      resumoRastreador: {
        total: paradaAnalysis.total,
        novas: paradaAnalysis.novas,
        possiveisTransitos: paradaAnalysis.possiveisTransitos,
        confirmadas: paradaAnalysis.confirmadas
      },
      statusCruzamento: scaleRows.length && trackerRow ? 'completo' : scaleRows.length ? 'sem rastreador' : trackerRow ? 'sem escala' : 'sem correspondência',
    };
  });
}
