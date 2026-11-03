export function buildImportRecord({ files = {}, rows = {}, dateKey = new Date().toISOString().slice(0, 10) }) {
  const safeFiles = Object.fromEntries(Object.entries(files).map(([sourceId, file]) => [sourceId, file ? {
    name: file.name || '',
    size: Number(file.size) || 0,
    lastModified: Number(file.lastModified) || 0,
    rows: Number(rows[sourceId]) || 0
  } : null]));
  return { dateKey, createdAt: new Date().toISOString(), files: safeFiles };
}
