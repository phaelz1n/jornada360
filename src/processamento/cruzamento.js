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

export function crossSources({ pointRows = [], scaleRows = [], trackerRows = [], standardRows = [] } = {}) {
  const scale = indexByDriver(scaleRows);
  const tracker = indexByDriver(trackerRows);
  const standard = indexByDriver(standardRows);
  return pointRows.map(point => {
    const key = normalizeDriverName(point.motorista);
    const scaleRows = findDriver(scale, key) || [];
    const trackerMatch = findDriver(tracker, key);
    const trackerRow = Array.isArray(trackerMatch) ? trackerMatch[0] : trackerMatch;
    const standardMatch = findDriver(standard, key);
    const standardRow = Array.isArray(standardMatch) ? standardMatch[0] : standardMatch;
    const paradaAnalysis = analisarParadasRastreador({ batidas: point.batidas || [], escala: scaleRows, rastreador: trackerRow || {} });
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
        motoristaHerdado: stop.motoristaHerdado
      }))
    } : null;
    return {
      ...point,
      ...(standardRow ? { padraoCadastradoMin: standardRow.extraNormalPadrao, metaDiaMin: standardRow.extraNormalPadrao } : {}),
      escalaEncontrada: scaleRows.length > 0,
      escala: matchedScale || null,
      linhasEscala: scaleRows,
      linhaExtraCandidata: Boolean(trackerRow && scaleRows.length && standardRow && scaleRows.some(row => !lineMatchesStandard(row, standardRow))),
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
