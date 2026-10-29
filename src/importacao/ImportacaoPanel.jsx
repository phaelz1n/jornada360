import { useMemo, useState } from 'react';
import { IMPORT_SOURCES, createImportState, setSourceFile } from './importacao-model.js';
import { readWorkbookRows } from './xlsx-reader.js';

function formatSize(bytes) {
  if (!bytes) return '';
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ImportacaoPanel({ onProcess }) {
  const [state, setState] = useState(createImportState);
  const [dateKey, setDateKey] = useState(() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; });
  const [message, setMessage] = useState('');
  const [rowData, setRowData] = useState({});
  const selectedCount = useMemo(() => Object.values(state.files).filter(Boolean).length, [state.files]);

  async function chooseFile(sourceId, event) {
    const file = event.target.files?.[0] || null;
    setState(current => setSourceFile(current, sourceId, file));
    setMessage('');
    if (file && window.XLSX) {
      try {
        const rows = await readWorkbookRows(file, window.XLSX);
        setRowData(current => ({ ...current, [sourceId]: rows }));
        setState(current => ({ ...current, rows: { ...(current.rows || {}), [sourceId]: rows.length } }));
      } catch (error) {
        setMessage(`Não foi possível ler ${file.name}: ${error.message}`);
      }
    } else if (file) setMessage('Leitor de planilhas ainda está carregando. Atualize a página e tente novamente.');
  }

  function process() {
    if (!state.ready) {
      setMessage('Selecione as quatro fontes obrigatórias para processar o dia.');
      return;
    }
    setMessage('Arquivos prontos. O processamento atual será utilizado nesta etapa.');
    onProcess?.({ files: state.files, rows: state.rows || {}, rowData, dateKey });
  }

  return <section className="import-panel">
    <div className="import-panel-heading"><div><span className="eyebrow">ENTRADA DE DADOS</span><h2>Importar arquivos do dia</h2><p>Selecione as planilhas usadas pela operação. O novo fluxo mantém o mesmo cruzamento do sistema atual.</p></div><span className="import-counter">{selectedCount}/5 arquivos</span></div>
    <label className="import-date">Data do relatório <input type="date" value={dateKey} onChange={event => setDateKey(event.target.value)} /></label>
    <div className="source-grid">{IMPORT_SOURCES.map(source => { const file = state.files[source.id]; return <label className={`source-card ${file ? 'selected' : ''}`} key={source.id}>
      <input type="file" accept=".xlsx,.xls,.csv" onChange={event => chooseFile(source.id, event)} />
      <span className="source-icon">{source.icon}</span><span className="source-copy"><strong>{source.label}</strong><small>{source.required ? 'Obrigatório' : 'Opcional'} · {source.description}</small>{file && <em>{file.name} {formatSize(file.size)}{state.rows?.[source.id] ? ` · ${state.rows[source.id]} linhas lidas` : ''}</em>}</span><span className="source-action">{file ? 'Trocar' : 'Selecionar'}</span>
    </label>; })}</div>
    {message && <div className="import-message" role="status">{message}</div>}
    <div className="import-actions"><button className="primary-button import-button" type="button" onClick={process} disabled={!state.ready}>Processar dia <span>→</span></button></div>
  </section>;
}
