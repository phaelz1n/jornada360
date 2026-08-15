import { useMemo, useState } from 'react';
import { Search, ShieldCheck } from 'lucide-react';
import { useAppState } from '../state/AppState';

export default function Auditoria() {
  const { auditLog } = useAppState();
  const [busca, setBusca] = useState('');

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return auditLog;
    return auditLog.filter(
      (a) =>
        a.entidade.toLowerCase().includes(termo) ||
        a.acao.toLowerCase().includes(termo) ||
        a.usuario.toLowerCase().includes(termo),
    );
  }, [auditLog, busca]);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Auditoria</h1>
          <p className="page-subtitle">Toda alteração manual registrada — nada é apagado sem histórico</p>
        </div>
      </div>

      <div className="card card-pad">
        <div className="toolbar">
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-faint)' }} />
            <input
              className="input"
              style={{ paddingLeft: 30, width: 280 }}
              placeholder="Buscar por usuário, entidade ou ação…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <div className="spacer" />
          <span className="text-faint" style={{ fontSize: 12.5 }}>
            {filtrados.length} evento(s)
          </span>
        </div>

        {filtrados.length === 0 ? (
          <div className="empty-state">
            <ShieldCheck size={26} />
            <div style={{ fontWeight: 600, marginTop: 8 }}>
              {auditLog.length === 0 ? 'Nenhuma alteração registrada ainda' : 'Nenhum evento corresponde à busca'}
            </div>
            <div style={{ marginTop: 4, maxWidth: 460 }}>
              {auditLog.length === 0
                ? 'Toda alteração manual — prioridade, responsável, prazo, resolução, aprovação, reprovação, cadastro — é registrada aqui automaticamente, com quem fez e por quê.'
                : 'Tente outro termo de busca.'}
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Usuário</th>
                  <th>Entidade</th>
                  <th>Ação</th>
                  <th>Anterior → Novo</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((a) => (
                  <tr key={a.id}>
                    <td className="mono cell-muted">{a.timestamp}</td>
                    <td className="cell-strong">{a.usuario}</td>
                    <td>{a.entidade}</td>
                    <td>{a.acao}</td>
                    <td className="mono">
                      {a.valorAnterior} → {a.valorNovo}
                    </td>
                    <td className="cell-muted" style={{ whiteSpace: 'normal', maxWidth: 280 }}>
                      {a.motivo}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
