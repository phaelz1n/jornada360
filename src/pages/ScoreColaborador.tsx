/* Score do Colaborador — multidimensional. A tela não calcula nada: pede o score pronto ao
 * scoreService e mostra, para cada colaborador, a nota geral e cada dimensão com a explicação de
 * como foi calculada. Dimensão não avaliada aparece como "não avaliada", nunca como zero. */
import { useMemo, useState } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { useHEEngineData } from '../engine/useHEEngineData';
import { useWorkspace } from '../workspace/WorkspaceContext';
import { calcularScores, type ScoreColaborador as Score } from '../services/scoreService';
import { Modal } from '../components/ui/Modal';
import { AmbienteSemDados, ExplicacaoIndicador } from '../components/ui/Indicadores';
import { initials } from '../utils/text';

function corDoScore(pct: number) {
  if (pct >= 90) return 'var(--green)';
  if (pct >= 70) return 'var(--orange)';
  return 'var(--red)';
}

export default function ScoreColaborador() {
  const { dias, refresh } = useHEEngineData();
  const { workspace } = useWorkspace();
  const [busca, setBusca] = useState('');
  const [detalhe, setDetalhe] = useState<Score | null>(null);

  const scores = useMemo(
    () => calcularScores(dias, workspace.rules.recurrenceLimit),
    [dias, workspace.rules.recurrenceLimit],
  );

  const comScore = scores.filter((s): s is Score & { scoreGeral: number } => s.scoreGeral !== null);
  const mediaGeral = comScore.length ? Math.round(comScore.reduce((s, m) => s + m.scoreGeral, 0) / comScore.length) : null;
  const emRisco = comScore.filter((m) => m.scoreGeral < 70).length;

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return [...scores]
      .filter((m) => !termo || m.motorista.toLowerCase().includes(termo))
      .sort((a, b) => (a.scoreGeral ?? 101) - (b.scoreGeral ?? 101));
  }, [scores, busca]);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Score do Colaborador</h1>
          <p className="page-subtitle">Média das dimensões avaliadas — clique em um colaborador para ver a composição</p>
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
              <div className="kpi-label">
                Score médio
                <ExplicacaoIndicador
                  comoFoiCalculado="Média dos scores gerais de todos os colaboradores avaliados. O score de cada um é a média simples das dimensões que puderam ser medidas para ele."
                  porqueAparece="Dá o nível geral da operação num número só, para comparar períodos entre si."
                />
              </div>
              <div className="kpi-value">{mediaGeral === null ? '—' : `${mediaGeral}%`}</div>
              <div className="kpi-foot">{mediaGeral === null ? 'sem base de cálculo ainda' : `${comScore.length} colaborador(es) avaliado(s)`}</div>
            </div>
            <div className={`kpi-card ${emRisco ? 'accent-red' : ''}`}>
              <div className="kpi-label">Abaixo de 70%</div>
              <div className="kpi-value">{emRisco}</div>
              <div className="kpi-foot">colaboradores que merecem atenção</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Avaliados</div>
              <div className="kpi-value">{scores.length}</div>
              <div className="kpi-foot">com registro nos dias processados</div>
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
                Ordenado do menor para o maior score
              </span>
            </div>

            {filtrados.length === 0 ? (
              <div className="empty-state" style={{ padding: '18px 12px' }}>
                Nenhum colaborador encontrado para “{busca}”.
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Colaborador</th>
                      <th>Setor</th>
                      <th style={{ minWidth: 180 }}>Score geral</th>
                      <th>Dias analisados</th>
                      <th>Reincidência</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.map((m) => (
                      <tr key={m.key}>
                        <td>
                          <div className="name-cell">
                            <span className="avatar">{initials(m.motorista)}</span>
                            <span className="cell-strong">{m.motorista}</span>
                          </div>
                        </td>
                        <td className="cell-muted">{m.setorMaisComum}</td>
                        <td>
                          {m.scoreGeral === null ? (
                            <span className="text-faint">Não avaliado</span>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div className="progress-track" style={{ flex: 1 }}>
                                <div
                                  className="progress-fill"
                                  style={{ width: `${m.scoreGeral}%`, background: corDoScore(m.scoreGeral) }}
                                />
                              </div>
                              <span className="cell-strong mono" style={{ width: 36, textAlign: 'right' }}>
                                {m.scoreGeral}%
                              </span>
                            </div>
                          )}
                        </td>
                        <td>{m.diasAnalisados}</td>
                        <td>
                          {m.reincidenteCritico ? (
                            <span className="badge badge-red">Acima do limite</span>
                          ) : (
                            <span className="badge badge-green">Dentro do limite</span>
                          )}
                        </td>
                        <td>
                          <button className="btn btn-sm" onClick={() => setDetalhe(m)}>
                            Ver composição
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {detalhe && (
        <Modal
          title={detalhe.motorista}
          subtitle={`${detalhe.diasAnalisados} dia(s) analisado(s) · ${detalhe.setorMaisComum}`}
          onClose={() => setDetalhe(null)}
        >
          <div className="field-label">Score geral</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: detalhe.scoreGeral === null ? 'var(--text-faint)' : corDoScore(detalhe.scoreGeral) }}>
            {detalhe.scoreGeral === null ? 'Não avaliado' : `${detalhe.scoreGeral}%`}
          </div>
          <p className="text-muted" style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 6 }}>
            Média simples das dimensões avaliadas abaixo. Todas as dimensões têm o mesmo peso — enquanto a empresa não definir
            pesos diferentes, tratar uma como mais importante que outra seria um julgamento que o sistema não tem base para fazer.
            Dimensões sem base de cálculo ficam de fora da média em vez de contar como zero.
          </p>

          <div className="field-label" style={{ marginTop: 18 }}>
            Dimensões
          </div>
          <div className="dimensao-lista">
            {detalhe.dimensoes.map((d) => (
              <div key={d.chave} className="dimensao-item">
                <div className="dimensao-topo">
                  <span className="cell-strong">{d.label}</span>
                  <span className="mono cell-strong">
                    {d.valor === null ? <span className="text-faint">Não avaliada</span> : `${d.valor}%`}
                  </span>
                </div>
                {d.valor !== null && (
                  <div className="progress-track" style={{ marginTop: 6 }}>
                    <div className="progress-fill" style={{ width: `${d.valor}%`, background: corDoScore(d.valor) }} />
                  </div>
                )}
                <div className="text-faint" style={{ fontSize: 11.5, marginTop: 5 }}>
                  {d.base}
                </div>
                <div className="text-muted" style={{ fontSize: 12, marginTop: 5, lineHeight: 1.5 }}>
                  {d.comoFoiCalculado}
                </div>
              </div>
            ))}
          </div>

          <div className="aviso-config" style={{ marginTop: 16, marginBottom: 0 }}>
            <span>
              Pontualidade e magnitude da hora extra ainda não entram no score: o motor não expõe atraso em minutos de forma
              estruturada, e não há limiar configurado que diga quantos minutos de excedente são demais. Os dois ficam de fora
              enquanto não existir esse dado — em vez de entrarem com um critério inventado.
            </span>
          </div>
        </Modal>
      )}
    </>
  );
}
