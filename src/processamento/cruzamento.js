import { normalizeDriverName } from './processamento-model.js';
import { analisarParadasRastreador } from './rastreador-analysis.js';

function indexByDriver(rows = []) {
  const map = new Map();
  for (const row of rows) {
    const name = normalizeDriverName(row.motorista || row.nome || row.colaborador);
    if (name) map.set(name, row);
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

export function crossSources({ pointRows = [], scaleRows = [], trackerRows = [] } = {}) {
  const scale = indexByDriver(scaleRows);
  const tracker = indexByDriver(trackerRows);
  return pointRows.map(point => {
    const key = normalizeDriverName(point.motorista);
    const scaleRow = findDriver(scale, key);
    const trackerRow = findDriver(tracker, key);
    const paradaAnalysis = analisarParadasRastreador({ batidas: point.batidas || [], escala: scaleRow ? [scaleRow] : [], rastreador: trackerRow || {} });
    return {
      ...point,
      escalaEncontrada: Boolean(scaleRow),
      escala: scaleRow || null,
      rastreioEncontrado: Boolean(trackerRow),
      rastreio: trackerRow || null,
      paradasRastreador: paradaAnalysis.paradas,
      resumoRastreador: paradaAnalysis,
      statusCruzamento: scaleRow && trackerRow ? 'completo' : scaleRow ? 'sem rastreador' : trackerRow ? 'sem escala' : 'sem correspondência',
    };
  });
}
