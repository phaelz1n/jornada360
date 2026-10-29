import { normalizeDriverName } from './processamento-model.js';

function indexByDriver(rows = []) {
  const map = new Map();
  for (const row of rows) {
    const name = normalizeDriverName(row.motorista || row.nome || row.colaborador);
    if (name) map.set(name, row);
  }
  return map;
}

export function crossSources({ pointRows = [], scaleRows = [], trackerRows = [] } = {}) {
  const scale = indexByDriver(scaleRows);
  const tracker = indexByDriver(trackerRows);
  return pointRows.map(point => {
    const key = normalizeDriverName(point.motorista);
    const scaleRow = scale.get(key);
    const trackerRow = tracker.get(key);
    return {
      ...point,
      escalaEncontrada: Boolean(scaleRow),
      escala: scaleRow || null,
      rastreioEncontrado: Boolean(trackerRow),
      rastreio: trackerRow || null,
      statusCruzamento: scaleRow && trackerRow ? 'completo' : scaleRow ? 'sem rastreador' : trackerRow ? 'sem escala' : 'sem correspondência',
    };
  });
}
