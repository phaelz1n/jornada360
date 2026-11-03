export const IMPORT_SOURCES = Object.freeze([
  { id: 'espelhoHoje', label: 'Espelho de ponto', description: 'Registros do dia selecionado', required: true, icon: '▤' },
  { id: 'escala', label: 'Escala', description: 'Linhas e horários programados', required: true, icon: '▦' },
  { id: 'rastreador', label: 'Rastreador', description: 'Trajetos e paradas', required: true, icon: '⌖' },
  { id: 'horarioPadrao', label: 'Horário padrão', description: 'Limites de horas extras', required: true, icon: '◷' },
  { id: 'espelhoOntem', label: 'Espelho de ontem', description: 'Opcional para interjornada', required: false, icon: '↶' }
]);

export function createImportState() {
  return { files: Object.fromEntries(IMPORT_SOURCES.map(source => [source.id, null])), ready: false };
}

export function setSourceFile(state, sourceId, file) {
  if (!IMPORT_SOURCES.some(source => source.id === sourceId)) throw new Error('Fonte de importação inválida');
  const files = { ...state.files, [sourceId]: file || null };
  const ready = IMPORT_SOURCES.filter(source => source.required).every(source => Boolean(files[source.id]));
  return { ...state, files, ready };
}
