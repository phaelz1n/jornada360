import { normalizeDriverName } from './processamento-model.js';
import { analisarParadasRastreador } from './rastreador-analysis.js';
import { getSectorPolicy } from './sector-rules.js';
import { durationFromPairs, nextDateKey, parseTimeMinutes } from './time-utils.js';

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

const timeOf = parseTimeMinutes;
function timeDistance(first, second) {
  if (first == null || second == null) return Infinity;
  const distance = Math.abs(first - second);
  return Math.min(distance, 1440 - distance);
}

function lineMatchesStandard(scaleRow, standardRow) {
  const scaleTime = timeOf(scaleRow?.horario || scaleRow?.inicio || scaleRow?.horarioInicio);
  return scaleTime != null && (standardRow?.horarios || []).some(value => {
    const standardTime = timeOf(value);
    return standardTime != null && Math.abs(standardTime - scaleTime) <= 15;
  });
}

const minutes = parseTimeMinutes;

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
  const descanso = inicioAtual >= fimAnterior ? inicioAtual - fimAnterior : inicioAtual + 1440 - fimAnterior;
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
      linhaEscala: stop?.linha || '',
      local: stop?.local || ''
    };
  });
  if (!evidence.length && outside > 0) evidence.push({ horario: '', diferencaMin: null, status: 'sem-evidencia', motivo: 'nenhuma-parada-proxima', local: '' });
  return { evidence, outside };
}

export function crossSources({ pointRows = [], previousPointRows = [], scaleRows = [], trackerRows = [], standardRows = [], patternHistory = {}, cadastro = {} } = {}) {
  const scale = indexByDriver(scaleRows);
  const tracker = indexByDriver(trackerRows);
  const standard = indexByDriver(standardRows);
  return pointRows.map(point => {
    const key = normalizeDriverName(point.motorista);
    const setor = cadastro[key]?.setor || cadastro[key]?.categoria || '';
    const sectorPolicy = getSectorPolicy(setor, point.dateKey);
    const setorNormalizado = sectorPolicy.key;
    const rastreioDispensado = !sectorPolicy.trackerRequired;
    const scaleRows = findDriver(scale, key) || [];
    const trackerMatch = findDriver(tracker, key);
    const rawTrackerRow = Array.isArray(trackerMatch) ? trackerMatch[0] : trackerMatch;
    const overnight = isOvernightJourney(point, scaleRows);
    const allowedDates = overnight && point.dateKey ? new Set([point.dateKey, nextDateKey(point.dateKey)]) : point.dateKey ? new Set([point.dateKey]) : null;
    const punches = (point.batidas || []).map(minutes).filter(value => value != null);
    const overnightEnd = overnight && punches.length ? punches[punches.length - 1] : null;
    const trackerRow = rawTrackerRow && allowedDates && Array.isArray(rawTrackerRow.paradas)
      ? { ...rawTrackerRow, paradas: rawTrackerRow.paradas.filter(stop => {
        if (stop.dataKey && !allowedDates.has(stop.dataKey)) return false;
        if (overnight && stop.dataKey === nextDateKey(point.dateKey) && overnightEnd != null) {
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
    const metaDiaMin = Math.max(0, Number(standardRow?.extraNormalPadrao ?? 0) || 0);
    const reportedHE = Number(point.totalHE ?? point.he1min ?? point.excedenteMin ?? 0) || 0;
    const actualDuration = durationFromPairs(point.batidas || []);
    const standardDuration = durationFromPairs(standardRow?.horarios || []);
    const batidasExtra = actualDuration && standardDuration ? Math.max(0, actualDuration - standardDuration) : null;
    const hasReportedExtra = ['totalHE', 'he1min', 'he2min', 'he3min', 'excedenteMin'].some(field => point[field] != null);
    const standardExtra = Number(standardRow?.extraNormalPadrao);
    const jornadaBaseMin = rastreioDispensado ? sectorPolicy.baseMinutes : null;
    const admExtra = rastreioDispensado && actualDuration > 0 ? Math.max(0, actualDuration - jornadaBaseMin) : null;
    const effectiveExtra = admExtra ?? batidasExtra;
    const extraScaleRows = scaleRows.filter(row => !lineMatchesStandard(row, standardRow));
    const trackerExtraLine = standardRow && paradaAnalysis.paradas.find(stop => extraScaleRows.some(row => {
      const scaleTime = timeOf(row.horario || row.inicio || row.horarioInicio);
      const trackerTime = timeOf(stop.horario);
      const sameLine = String(row.linha || row.nome || '').trim() && String(row.linha || row.nome || '').trim() === String(stop.linha || '').trim();
      return (sameLine && !stop.foraDaEscala) || timeDistance(scaleTime, trackerTime) <= 30;
    }));
    const punchExtraLine = standardRow && extraScaleRows.map(row => {
      const scaleTime = timeOf(row.horario || row.inicio || row.horarioInicio);
      if (scaleTime == null) return null;
      const nearestPunch = punches.map(punch => ({ punch, distance: timeDistance(punch, scaleTime) })).sort((a, b) => a.distance - b.distance)[0];
      return nearestPunch && nearestPunch.distance <= 30 ? { ...row, horario: row.horario || row.inicio || row.horarioInicio, diferencaMin: nearestPunch.distance } : null;
    }).filter(Boolean).sort((a, b) => a.diferencaMin - b.diferencaMin)[0];
    const extraLineEvidence = trackerExtraLine || punchExtraLine;
    const extraValidatedBySources = Boolean(trackerExtraLine);
    const justificativaSugerida = extraLineEvidence?.linha
      ? `${trackerExtraLine ? 'Escala e rastreador indicam' : 'Escala e batida próxima indicam'} que o motorista realizou o cliente/linha “${extraLineEvidence.linha}”${extraLineEvidence.horario ? ` às ${extraLineEvidence.horario}` : ''}; o horário diverge do padrão cadastrado.`
      : '';
    const extraCandidate = Math.max(0, reportedHE, batidasExtra || 0);
    const extraAuditoriaStatus = extraLineEvidence
      ? trackerExtraLine ? 'linha-extra-com-rastreio' : 'possivel-linha-extra'
      : standardExtra <= 0 && extraCandidate > 0
        ? extraScaleRows.length ? 'possivel-linha-extra' : trackerRow ? 'rastreio-sem-linha' : 'sem-escala-sem-rastreio'
      : 'sem-extra';
    const totalHE = rastreioDispensado && admExtra != null
      ? admExtra
      : standardExtra > 0 && hasReportedExtra
      ? reportedHE
      : standardExtra <= 0 && hasReportedExtra && extraValidatedBySources
        ? reportedHE
        : batidasExtra != null ? batidasExtra : reportedHE;
    const trackerEvidence = rastreioDispensado ? { evidence: [], outside: 0 } : buildEvidence({ batidas: point.batidas || [], paradaAnalysis, totalHE, metaDiaMin });
    const history = patternHistory?.[key] || [];
    const repeatedRealized = history.length >= 5 && history.slice(-5).every(value => Math.abs(Number(value) - totalHE) <= 5);
    const foraDaEscalaSemLinha = paradaAnalysis.paradas.find(stop => stop.foraDaEscala && !extraScaleRows.some(row => {
      const scaleTime = timeOf(row.horario || row.inicio || row.horarioInicio);
      const trackerTime = timeOf(stop.horario);
      return timeDistance(scaleTime, trackerTime) <= 30;
    }));
    return {
      ...point,
      ...(effectiveExtra != null ? { totalHE: totalHE, excedenteMin: totalHE, he1min: totalHE, he2min: 0, he3min: 0, heBucketsExplicit: true } : {}),
      ...intervalAnalysis,
      descansoInterjornadaMin,
      interjornadaProblema: descansoInterjornadaMin != null ? descansoInterjornadaMin < 660 : intervalAnalysis.interjornadaProblema,
      semHorarioPadrao: !standardRow && !rastreioDispensado,
      padraoStatus: standardRow ? 'encontrado' : rastreioDispensado ? `dispensado_${setorNormalizado.toLocaleLowerCase('pt-BR')}` : 'sem_cadastro',
      ...(rastreioDispensado ? { jornadaBaseMin } : {}),
      ...(standardRow ? { padraoCadastradoMin: standardRow.extraNormalPadrao, metaDiaMin: standardRow.extraNormalPadrao } : {}),
      ...(standardRow ? { padraoHorarios: standardRow.horarios || [] } : {}),
      ...(effectiveExtra != null ? { batidasExtraMin: effectiveExtra, extraCalculadaPelasBatidas: true } : {}),
      ...(standardRow ? { heDentroPadraoMin: Math.min(totalHE, metaDiaMin), heAcimaPadraoMin: Math.max(0, totalHE - metaDiaMin) } : {}),
      evidenciaRastreador: trackerEvidence.evidence,
      rastreiosForaDaEscala: paradaAnalysis.paradas.filter(stop => stop.foraDaEscala).map(stop => ({ horario: stop.horario, escalaHorario: stop.escalaHorario, diferencaMin: stop.diferencaMin, local: stop.local, motivo: stop.motivo })),
      rastreadorStatus: rastreioDispensado ? 'nao-aplicavel' : trackerEvidence.evidence.some(item => item.status === 'confirmada') ? 'confirmado' : trackerEvidence.evidence.length ? 'divergente' : 'sem-evidencia',
      rastreioDispensado,
      padraoSuspeito: repeatedRealized && standardRow && totalHE > metaDiaMin,
      escalaEncontrada: scaleRows.length > 0,
      escala: matchedScale || null,
      linhasEscala: scaleRows,
      linhaExtraCandidata: Boolean(extraLineEvidence),
      linhaExtraDetalhe: extraLineEvidence ? `Possível linha extra: ${extraLineEvidence.linha || 'linha da escala'} — consta na escala de ${point.dateKey || 'do relatório'} e há ${trackerExtraLine ? 'rastreio' : 'batida'} compatível, mas não consta no horário padrão.` : '',
      ...(justificativaSugerida ? { justificativaSugerida } : {}),
      extraAuditoriaStatus,
      extraCandidataMin: standardExtra <= 0 ? extraCandidate : 0,
      extraAuditoriaDetalhe: extraAuditoriaStatus === 'possivel-linha-extra' ? 'Há uma linha na escala fora do horário padrão, mas falta confirmação do rastreador.' : extraAuditoriaStatus === 'rastreio-sem-linha' ? 'Há rastreio no período, mas não foi encontrada linha correspondente na escala.' : extraAuditoriaStatus === 'sem-escala-sem-rastreio' ? 'Há extra candidata no ponto, mas não foi encontrada escala nem rastreio para comprovação.' : '',
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
      statusCruzamento: scaleRows.length && (trackerRow || rastreioDispensado) ? 'completo' : scaleRows.length ? 'sem rastreador' : trackerRow ? 'sem escala' : 'sem correspondência',
    };
  });
}
