import { Link } from 'react-router-dom';
import { RefreshCw, ArrowRight, Trash2 } from 'lucide-react';
import { useHEEngineData } from '../../engine/useHEEngineData';
import { dkToLabel, minToStrSigned } from '../../engine/heEngineCore';

export function RealOperacaoResumo() {
  const { dias, refresh, limparHistorico } = useHEEngineData();

  function confirmarLimpeza() {
    const ok = window.confirm(
      `Isso apaga os ${dias.length} dia(s) processados aqui no Jornada360 (só nesta cópia do navegador — o arquivo original que você abre por fora não é afetado). Quer continuar?`,
    );
    if (ok) limparHistorico();
  }

  if (dias.length === 0) {
    return (
      <div className="card card-pad section-gap">
        <div className="card-title">Operação Real — Assistente HE Diário</div>
        <div className="empty-state" style={{ padding: '24px 20px' }}>
          Nenhum dia processado ainda.{' '}
          <Link to="/motor-he" style={{ color: 'var(--brand-600)', fontWeight: 700 }}>
            Suba os arquivos do dia
          </Link>{' '}
          para ver os números reais aqui.
        </div>
      </div>
    );
  }

  const totalHE = dias.reduce((s, d) => s + d.totalHEAtual, 0);
  const totalPendentes = dias.reduce((s, d) => s + d.pendentes, 0);
  const ultimosDias = [...dias].sort((a, b) => b.dateKey.localeCompare(a.dateKey)).slice(0, 6);

  return (
    <div className="card card-pad section-gap">
      <div className="card-title">
        Operação Real — Assistente HE Diário
        <span style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sm" onClick={refresh}>
            <RefreshCw size={13} />
            Sincronizar
          </button>
          <button className="btn btn-sm btn-danger" onClick={confirmarLimpeza}>
            <Trash2 size={13} />
            Limpar histórico
          </button>
        </span>
      </div>
      <div className="kpi-grid" style={{ marginBottom: 14 }}>
        <div className="kpi-card">
          <div className="kpi-label">Dias processados</div>
          <div className="kpi-value">{dias.length}</div>
          <div className="kpi-foot">via upload real</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">HE1 acumulado</div>
          <div className="kpi-value">{minToStrSigned(totalHE)}</div>
          <div className="kpi-foot">soma de todos os dias</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Pendentes</div>
          <div className="kpi-value">{totalPendentes}</div>
          <div className="kpi-foot">casos ainda não resolvidos</div>
        </div>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Dia</th>
              <th>HE1 total</th>
              <th>Colaboradores</th>
              <th>Pendentes</th>
            </tr>
          </thead>
          <tbody>
            {ultimosDias.map((d) => (
              <tr key={d.dateKey}>
                <td className="mono">{dkToLabel(d.dateKey)}</td>
                <td className="mono">{minToStrSigned(d.totalHEAtual)}</td>
                <td>{d.items.length}</td>
                <td>
                  <span className={`badge ${d.pendentes ? 'badge-red' : 'badge-green'}`}>{d.pendentes}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Link to="/pendencias" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 12.5, color: 'var(--brand-600)', fontWeight: 700, textDecoration: 'none' }}>
        Ver pendências reais <ArrowRight size={13} />
      </Link>
    </div>
  );
}
