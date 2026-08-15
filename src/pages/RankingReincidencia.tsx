import { useMemo, useState } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { useHEEngineData } from '../engine/useHEEngineData';
import { calcularReincidencia } from '../services/recurrenceService';
import { minToStrSigned } from '../engine/heEngineCore';
import { AmbienteSemDados } from '../components/ui/Indicadores';
import { initials } from '../utils/text';
import { useWorkspace } from '../workspace/WorkspaceContext';

export default function RankingReincidencia() {
  const { dias, refresh } = useHEEngineData();
  const { workspace } = useWorkspace();
  const [busca, setBusca] = useState('');
  const recurrenceLimit = workspace.rules.recurrenceLimit;

  const ranking = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return calcularReincidencia(dias, recurrenceLimit).filter(
      (m) => !termo || m.motorista.toLowerCase().includes(termo),
    );
  }, [dias, busca, recurrenceLimit]);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Ranking de Reincidência</h1>
          <p className="page-subtitle">Colaboradores com divergências recorrentes acima do padrão cadastrado</p>
        </div>
        <button className="btn" onClick={refresh}>
          <RefreshCw size={14} />
          Atualizar
        </button>
      </div>

      {dias.length === 0 ? (
        <div className="card card-pad">
          <AmbienteSemDados />
        </div>
      ) : (
        <div className="card card-pad">
          <div className="toolbar">
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-faint)' }} />
              <input
                className="input"
                style={{ paddingLeft: 30, width: 240 }}
                placeholder="Buscar colaborador…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <div className="spacer" />
            <span className="text-faint" style={{ fontSize: 12.5 }}>
              {ranking.length} colaborador(es) com reincidência · sinalizamos quem passou de {recurrenceLimit}x
            </span>
          </div>

          {ranking.length === 0 ? (
            <div className="empty-state">Nenhuma reincidência nos dias processados até agora.</div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Colaborador</th>
                    <th>Setor</th>
                    <th>Dias acima do padrão</th>
                    <th>Excedente acumulado</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((m, i) => (
                    <tr key={m.key}>
                      <td className="cell-strong">{i + 1}</td>
                      <td>
                        <div className="name-cell">
                          <span className="avatar">{initials(m.motorista)}</span>
                          <span className="cell-strong">{m.critico ? '⚠️ ' : ''}{m.motorista}</span>
                        </div>
                      </td>
                      <td className="cell-muted">{m.setorMaisComum}</td>
                      <td>
                        <span className={`badge ${m.critico ? 'badge-red' : 'badge-orange'}`}>{m.diasAcimaPadrao}x de {m.diasAnalisados}</span>
                      </td>
                      <td className="mono">{minToStrSigned(m.excedenteTotalMin)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}
