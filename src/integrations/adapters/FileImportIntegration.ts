import type { IntegrationAdapter, ImportResultado } from '../IntegrationService';

function parseCsv(texto: string): { headers: string[]; rows: string[][] } {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const delimitador = linhas[0]?.includes(';') ? ';' : ',';
  const headers = (linhas[0] ?? '').split(delimitador).map((h) => h.trim());
  const rows = linhas.slice(1).map((l) => l.split(delimitador));
  return { headers, rows };
}

/* Único adapter com corpo real nesta fase — importação universal de planilha (CSV), independente
 * de fornecedor. Usado por src/pages/ImportarDados.tsx. */
export const FileImportIntegration: IntegrationAdapter = {
  tipo: 'excel_csv',
  nome: 'Importação Excel/CSV',
  disponivel: true,
  async importar(input: unknown): Promise<ImportResultado> {
    const texto = String(input);
    const { headers, rows } = parseCsv(texto);
    const erros: string[] = [];
    let validos = 0;
    rows.forEach((row, i) => {
      if (row.length !== headers.length) {
        erros.push(`Linha ${i + 2}: esperava ${headers.length} coluna(s), encontrou ${row.length}.`);
      } else {
        validos++;
      }
    });
    return {
      registrosEncontrados: rows.length,
      registrosValidos: validos,
      registrosComErro: rows.length - validos,
      erros,
    };
  },
};
