import { normalizeVacationRecord } from './ferias-model.js';

const DATE = '(\\d{2}\\/\\d{2}\\/\\d{4})';
const NAME = '([A-ZÁÀÃÂÉÊÍÓÔÕÚÇÜ][A-ZÁÀÃÂÉÊÍÓÔÕÚÇÜ\\s.-]{4,})';

function brDate(value) {
  const [day, month, year] = value.split('/');
  return `${year}-${month}-${day}`;
}

function compact(value) {
  return String(value || '').split('|').map(item => item.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' | ');
}

export function parseVacationPdfText(text, sourceImportId = '') {
  const source = compact(text);
  const records = [];
  const workerPattern = new RegExp(`${DATE} \\| ${NAME} \\| 1 \\|`, 'g');
  let match;
  while ((match = workerPattern.exec(source))) {
    const blockEnd = source.indexOf(' Programação de férias:', match.index);
    const block = source.slice(match.index, blockEnd > match.index ? blockEnd : source.length);
    const next = block.match(new RegExp(`Próximas férias: \\| ${DATE} \\| até \\| ${DATE} \\| ${DATE} \\| (\\d+)`));
    if (!next) continue;
    records.push(normalizeVacationRecord({
      codigo: '',
      trabalhador: match[2],
      saldo: next[4],
      limiteGozo: brDate(next[3]),
      periodoAquisitivo: `${next[1]} a ${next[2]}`,
      origem: sourceImportId
    }));
  }
  return records.filter(record => record.employeeName && record.gozoLimit);
}

export async function extractVacationPdf(file) {
  if (!file) throw new Error('Selecione um PDF de previsão de férias.');
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const buffer = new Uint8Array(await file.arrayBuffer());
  const document = await pdfjs.getDocument({ data: buffer }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map(item => item.str).join(' | '));
  }
  return pages.join(' | ');
}
