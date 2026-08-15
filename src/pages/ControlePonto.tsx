/* Controle de Ponto — listagem de todos os registros analisados.
 *
 * Lê os registros já classificados via analyticsService (não chama `heAggregations` nem
 * reimplementa a derivação de status): a mesma taxonomia unificada que Pendências e Centro de Ações
 * usam aparece aqui, para o mesmo caso nunca ter dois rótulos diferentes em telas diferentes. */
import { useMemo, useState } from 'react';
import { Search, RefreshCw, AlertTriangle } from 'lucide-react';
import { useHEEngineData } from '../engine/useHEEngineData';
import { listarRegistrosAnalisados } from '../services/analyticsService';
import { alertasDeJornada } from '../services/journeyService';
import { StatusPendenciaBadge, PadraoStatusBadge } from '../components/ui/Badges';
import { usePagination } from '../hooks/usePagination';
import { Pagination } from '../components/ui/Pagination';
import { AmbienteSemDados } from '../components/ui/Indicadores';
import { initials } from '../utils/text';
import { STATUS_PENDENCIA_LABEL, type StatusPendencia } from '../domain/Pendencia';

type Filtro = StatusPendencia | 'todos' | 'alerta_jornada';

const FILTROS: { key: Filtro; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'divergencia', label: STATUS_PENDENCIA_LABEL.divergencia },
  { key: 'atencao', label: STATUS_PENDENCIA_LABEL.atencao },
  { key: 'pendente', label: STATUS_PENDENCIA_LABEL.pendente },
  { key: 'justificado', label: STATUS_PENDENCIA_LABEL.justificado },
  { key: 'normal', label: STATUS_PENDENCIA_LABEL.normal },
  { key: 'alerta_jornada', label: 'Alerta de jornada' },
];

export default function ControlePonto() {
  const { dias, refresh } = useHEEngineData();
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');

  const registros = useMemo(() => listarRegistrosAnalisados(dias), [dias]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return registros.filter((r) => {
      if (filtro === 'alerta_jornada' && !r.temAlertaJornada) return false;
      if (filtro !== 'todos' && filtro !== 'alerta_jornada' && r.status !== filtro) return false;
      if (termo && !r.item.motorista.toLowerCase().includes(termo)) return false;
      return true;
    });
  }, [registros, busca, filtro]);

  const { page, totalPages, pageItems, next, prev } = usePagination(filtrados, 14);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Controle de Ponto</h1>
          <p className="page-subtitle">Todos os registros processados, com a mesma classificação usada em Pendências</p>
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
            <div className="filter-pill">
              {FILTROS.map((f) => (
                <button key={f.key} className={filtro === f.key ? 'active' : ''} onClick={() => setFiltro(f.key)}>
                  {f.label}
                </button>
              ))}
            </div>
            <div className="spacer" />
            <span className="text-faint" style={{ fontSize: 12.5 }}>
              {filtrados.length} de {registros.length} registro(s)
            </span>
          </div>

          {filtrados.length === 0 ? (
            <div className="empty-state">Nenhum registro corresponde aos filtros aplicados.</div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Colaborador</th>
                    <th>Data</th>
                    <th>HE1</th>
                    <th>Batidas</th>
                    <th>Situação</th>
                    <th>Padrão</th>
                    <th>Jornada</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((r) => {
                    const alertas = alertasDeJornada(r.item);
                    return (
                      <tr key={r.dateKey + '_' + r.item._key}>
                        <td>
                          <div className="name-cell">
                            <span className="avatar">{initials(r.item.motorista)}</span>
                            <span className="cell-strong">{r.item.motorista}</span>
                          </div>
                        </td>
                        <td className="mono">{r.dateLabel}</td>
                        <td className="mono">{r.item._heStr}</td>
                        <td className="mono" style={{ fontSize: 12 }}>
                          {r.item.batidas || '—'}
                        </td>
                        <td>
                          <StatusPendenciaBadge status={r.status} />
                        </td>
                        <td>
                          <PadraoStatusBadge status={r.item._padraoStatus} excedenteMin={r.item._excedenteMin} />
                        </td>
                        <td>
                          {alertas.length === 0 ? (
                            <span className="text-faint">—</span>
                          ) : (
                            <span className="alerta-jornada" title={alertas.map((a) => a.descricao).join(' · ')}>
                              <AlertTriangle size={13} />
                              {alertas.length === 1 ? (alertas[0].tipo === 'interjornada' ? 'Descanso' : 'Pausa') : `${alertas.length} alertas`}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={page} totalPages={totalPages} onPrev={prev} onNext={next} totalItems={filtrados.length} />
        </div>
      )}
    </>
  );
}
