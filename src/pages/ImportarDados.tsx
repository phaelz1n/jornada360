import { useRef, useState, type DragEvent } from 'react';
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useAppState } from '../state/AppState';

interface Preview {
  fileName: string;
  headers: string[];
  rows: string[][];
  totalRows: number;
  linhasComProblema: number;
}

function parseCsv(text: string): Preview {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const delimiter = lines[0]?.includes(';') ? ';' : ',';
  const headers = (lines[0] ?? '').split(delimiter).map((h) => h.trim());
  const dataLines = lines.slice(1);
  const rows = dataLines.slice(0, 8).map((l) => l.split(delimiter));
  const linhasComProblema = dataLines.filter((l) => l.split(delimiter).length !== headers.length).length;
  return { fileName: '', headers, rows, totalRows: dataLines.length, linhasComProblema };
}

export default function ImportarDados() {
  const { registrarAuditoria, usuarioAtual } = useAppState();
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [importado, setImportado] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    setImportado(false);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const parsed = parseCsv(text);
      parsed.fileName = file.name;
      setPreview(parsed);
    };
    reader.readAsText(file, 'utf-8');
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function confirmarImportacao() {
    if (!preview) return;
    registrarAuditoria({
      usuario: usuarioAtual,
      entidade: `Importação — ${preview.fileName}`,
      acao: 'Importação de planilha de ponto',
      valorAnterior: '—',
      valorNovo: `${preview.totalRows} linhas importadas${preview.linhasComProblema ? `, ${preview.linhasComProblema} com divergência de colunas` : ''}`,
      motivo: 'Importação manual via Central de Importação.',
    });
    setImportado(true);
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Importar Dados</h1>
          <p className="page-subtitle">Importação universal de ponto/escala via planilha (CSV) — independente de fornecedor</p>
        </div>
      </div>

      <div className="card card-pad section-gap">
        <div
          className={`dropzone${dragActive ? ' drag-active' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
        >
          <UploadCloud size={30} style={{ marginBottom: 8, color: 'var(--brand-500)' }} />
          <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            Arraste um arquivo .csv aqui, ou clique para selecionar
          </div>
          <div style={{ fontSize: 12.5 }}>Colunas esperadas: Data, Colaborador, Evento, Horário</div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <button className="btn" style={{ marginTop: 14 }} onClick={() => inputRef.current?.click()}>
            Selecionar arquivo
          </button>
        </div>
      </div>

      {preview && (
        <div className="card card-pad">
          <div className="card-title">
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileSpreadsheet size={16} />
              {preview.fileName}
            </span>
            {importado ? (
              <span className="badge badge-green">
                <CheckCircle2 size={11} /> Importado
              </span>
            ) : (
              <span className="badge badge-blue">Pré-visualização</span>
            )}
          </div>

          <div className="chip-row section-gap">
            <span className="badge badge-gray">{preview.totalRows} linhas detectadas</span>
            <span className="badge badge-gray">{preview.headers.length} colunas</span>
            {preview.linhasComProblema > 0 ? (
              <span className="badge badge-orange">
                <AlertTriangle size={11} /> {preview.linhasComProblema} linhas com número de colunas inconsistente
              </span>
            ) : (
              <span className="badge badge-green">
                <CheckCircle2 size={11} /> Estrutura consistente
              </span>
            )}
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {preview.headers.map((h, i) => (
                    <th key={i}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.totalRows > preview.rows.length && (
            <p className="text-faint" style={{ fontSize: 12, marginTop: 8 }}>
              mostrando {preview.rows.length} de {preview.totalRows} linhas
            </p>
          )}

          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={confirmarImportacao} disabled={importado}>
              {importado ? 'Importação confirmada' : 'Confirmar importação'}
            </button>
            <button
              className="btn"
              onClick={() => {
                setPreview(null);
                setImportado(false);
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
