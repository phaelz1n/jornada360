import { stableDriverId } from '../modelos/identificadores.mjs';

export function collectAllDrivers(sources = []) {
  const byId = new Map();
  for (const source of sources) {
    if (!source?.nome) continue;
    const id = stableDriverId(source);
    const current = byId.get(id);
    byId.set(id, {
      id,
      nome: current?.nome || String(source.nome).trim(),
      matricula: current?.matricula || String(source.matricula || '').trim(),
      setor: source.setor || current?.setor || 'Sem setor',
      categoria: source.categoria || current?.categoria || '',
      fontes: [...new Set([...(current?.fontes || []), source.fonte || 'importacao'])]
    });
  }
  return [...byId.values()];
}

