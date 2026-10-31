export async function readWorkbookRows(file, XLSX, { sheetName, raw = false } = {}) {
  if (!file || typeof file.arrayBuffer !== 'function') throw new Error('Arquivo não informado');
  if (!XLSX?.read || !XLSX?.utils?.sheet_to_json) throw new Error('Leitor XLSX indisponível');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const selectedSheet = sheetName || workbook.SheetNames?.[0];
  if (!selectedSheet || !workbook.Sheets?.[selectedSheet]) throw new Error('A planilha não possui uma aba válida');
  return XLSX.utils.sheet_to_json(workbook.Sheets[selectedSheet], { header: 1, raw, defval: null });
}
