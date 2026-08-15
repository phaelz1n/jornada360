import { useMemo, useState } from 'react';
import { Search, ArrowUpDown, RefreshCw } from 'lucide-react';
import { useHEEngineData } from '../engine/useHEEngineData';
import { resumoPorColaborador, type MotoristaAgregado } from '../services/overtimeService';
import { minToStrSigned } from '../engine/heEngineCore';
import { usePagination } from '../hooks/usePagination';
import { Pagination } from '../components/ui/Pagination';
import { AmbienteSemDados } from '../components/ui/Indicadores';
import { initials } from '../utils/text';

type SortKey = 'heTotalMin' | 'excedenteTotalMin' | 'diasAcimaPadrao';

export default function HorasExtras() {
  const { dias, refresh } = useHEEngineData();
  const [busca, setBusca] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('excedenteTotalMin');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const agregados = useMemo(() => resumoPorColaborador(dias), [dias]);

  const totais = agregados.reduce(
    (acc, m) => ({
      heTotalMin: acc.heTotalMin + m.heTotalMin,
      excedenteTotalMin: acc.excedenteTotalMin + m.excedenteTotalMin,
    }),
    { heTotalMin: 0, excedenteTotalMin: 0 },
  );

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const base = termo ? agregados.filter((m) => m.motorista.toLowerCase().includes(termo)) : agregados;
    return [...base].sort((a, b) => (sortDir === 'desc' ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey]));
  }, [agregados, busca, sortKey, sortDir]);

  const { page, totalPages, pageItems, next, prev } = usePagination(filtrados, 14);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Horas Extras — HE1</h1>
          <p className="page-subtitle">Acumulado por colaborador, somando todos os dias processados</p>
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
        <>
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-label">HE1 acumulado</div>
              <div className="kpi-value">{minToStrSigned(totais.heTotalMin)}</div>
              <div className="kpi-foot">soma de {dias.length} dia(s)</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Excedente acumulado</div>
              <div className="kpi-value">{minToStrSigned(totais.excedenteTotalMin)}</div>
              <div className="kpi-foot">acima do padrão cadastrado</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Colaboradores com excedente</div>
              <div className="kpi-value">{agregados.filter((m) => m.diasAcimaPadrao > 0).length}</div>
              <div className="kpi-foot">de {agregados.length} analisados</div>
            </div>
          </div>

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
                {filtrados.length} colaborador(es)
              </span>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Colaborador</th>
                    <th>Setor</th>
                    <th className="sortable" onClick={() => toggleSort('heTotalMin')}>
                      HE1 total <ArrowUpDown size={11} style={{ verticalAlign: -1 }} />
                    </th>
                    <th className="sortable" onClick={() => toggleSort('excedenteTotalMin')}>
                      Excedente <ArrowUpDown size={11} style={{ verticalAlign: -1 }} />
                    </th>
                    <th className="sortable" onClick={() => toggleSort('diasAcimaPadrao')}>
                      Dias acima do padrão <ArrowUpDown size={11} style={{ verticalAlign: -1 }} />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((m: MotoristaAgregado) => (
                    <tr key={m.key}>
                      <td>
                        <div className="name-cell">
                          <span className="avatar">{initials(m.motorista)}</span>
                          <span className="cell-strong">{m.motorista}</span>
                        </div>
                      </td>
                      <td className="cell-muted">{m.setorMaisComum}</td>
                      <td className="mono">{minToStrSigned(m.heTotalMin)}</td>
                      <td className="mono">
                        <span className={`badge ${m.excedenteTotalMin > 120 ? 'badge-red' : m.excedenteTotalMin > 0 ? 'badge-orange' : 'badge-green'}`}>
                          {minToStrSigned(m.excedenteTotalMin)}
                        </span>
                      </td>
                      <td>{m.diasAcimaPadrao} de {m.diasAnalisados}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} onPrev={prev} onNext={next} totalItems={filtrados.length} />
          </div>
        </>
      )}
    </>
  );
}
