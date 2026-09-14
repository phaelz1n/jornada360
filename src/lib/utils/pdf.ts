// ============================================================
// PDF Text Extraction Helper
// ============================================================

/**
 * Extrai texto completo de um arquivo PDF recebido como ArrayBuffer.
 * Funciona tanto via pdfjs-dist quanto com fallback para streams de texto.
 */
export async function extractTextFromPDF(buffer: ArrayBuffer): Promise<string> {
  try {
    const pdfjs = await import('pdfjs-dist');
    
    // Configurar worker para client-side se estiver no browser
    if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    }

    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
      disableFontFace: true,
    });

    const pdf = await loadingTask.promise;
    let fullText = '';

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageStrings = textContent.items.map((item: any) => {
        if ('str' in item) return item.str;
        return '';
      });
      fullText += pageStrings.join(' ') + '\n';
    }

    if (fullText.trim().length > 0) {
      return fullText;
    }
  } catch (err) {
    console.warn('pdfjs extraction failed or worker unavailable, trying fallback binary scanner:', err);
  }

  // Fallback: extrai cadeias legíveis de texto de streams / strings ASCII
  return extractRawTextFromBuffer(buffer);
}

function extractRawTextFromBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let result = '';
  let currentChunk = '';

  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    // Printable ASCII or Latin-1 characters
    if ((b >= 32 && b <= 126) || b >= 160 || b === 10 || b === 13 || b === 9) {
      currentChunk += String.fromCharCode(b);
    } else {
      if (currentChunk.length > 3) {
        result += currentChunk + ' ';
      }
      currentChunk = '';
    }
  }
  if (currentChunk.length > 3) {
    result += currentChunk;
  }
  return result;
}
