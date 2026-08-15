import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Schedule } from '../../domain';
import { novoId, type TabProps } from './types';
import { FeedbackGravacao } from '../../components/ui/EstadosAsync';

const DIAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
const RASCUNHO_VAZIO = { nome: '', entrada: '', saida: '', diasTrabalhados: ['seg', 'ter', 'qua', 'qui', 'sex'] as string[], heProgramadaMin: 0 };

export function EscalasTab({ workspace, gravar, gravacao, recarregar, podeEditar }: TabProps) {
  const [rascunho, setRascunho] = useState(RASCUNHO_VAZIO);

  function toggleDia(dia: string) {
    setRascunho((r) => ({
      ...r,
      diasTrabalhados: r.diasTrabalhados.includes(dia) ? r.diasTrabalhados.filter((d) => d !== dia) : [...r.diasTrabalhados, dia],
    }));
  }

  const podeAdicionar = rascunho.nome.trim() && rascunho.entrada && rascunho.saida;

  async function adicionar() {
    if (!podeAdicionar) return;
    const nova: Schedule = {
      id: novoId('esc'),
      nome: rascunho.nome,
      entrada: rascunho.entrada,
      saida: rascunho.saida,
      diasTrabalhados: rascunho.diasTrabalhados,
      folgas: DIAS.filter((d) => !rascunho.diasTrabalhados.includes(d)),
      heProgramadaMin: rascunho.heProgramadaMin,
    };
    const ok = await gravacao.executar(() => gravar((repo, ctx) => repo.salvarEscala(ctx.empresaId, nova, ctx.versao)));
    if (ok !== null) setRascunho(RASCUNHO_VAZIO);
  }

  function remover(id: string) {
    void gravacao.executar(() => gravar((repo, ctx) => repo.excluirEscala(ctx.empresaId, id, ctx.versao)));
  }

  return (
    <div className="card card-pad">
      <div className="card-title">Escalas</div>
      <p className="text-muted" style={{ fontSize: 12.5, marginTop: -8, marginBottom: 14 }}>
        Entrada e saída não vêm pré-preenchidas — cada operação tem um turno diferente, defina o
        horário real desta empresa.
      </p>
      <div className="toolbar" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <div className="kpi-label" style={{ marginBottom: 6 }}>Nome</div>
          <input className="input" value={rascunho.nome} onChange={(e) => setRascunho((r) => ({ ...r, nome: e.target.value }))} placeholder="Turno manhã..." />
        </div>
        <div>
          <div className="kpi-label" style={{ marginBottom: 6 }}>Entrada</div>
          <input className="input" style={{ width: 90 }} type="time" value={rascunho.entrada} onChange={(e) => setRascunho((r) => ({ ...r, entrada: e.target.value }))} />
        </div>
        <div>
          <div className="kpi-label" style={{ marginBottom: 6 }}>Saída</div>
          <input className="input" style={{ width: 90 }} type="time" value={rascunho.saida} onChange={(e) => setRascunho((r) => ({ ...r, saida: e.target.value }))} />
        </div>
        <div>
          <div className="kpi-label" style={{ marginBottom: 6 }}>HE programada (min)</div>
          <input className="input" style={{ width: 90 }} type="number" min={0} value={rascunho.heProgramadaMin} onChange={(e) => setRascunho((r) => ({ ...r, heProgramadaMin: Number(e.target.value) }))} />
        </div>
        <button className="btn btn-primary" onClick={() => void adicionar()} disabled={!podeAdicionar || !podeEditar || gravacao.estado === 'salvando'}>Adicionar</button>
        <FeedbackGravacao estado={gravacao.estado} erro={gravacao.erro} aoRecarregar={() => void recarregar()} />
      </div>

      <div className="chip-row section-gap">
        {DIAS.map((d) => (
          <button
            key={d}
            className={`btn btn-sm ${rascunho.diasTrabalhados.includes(d) ? 'btn-primary' : ''}`}
            onClick={() => toggleDia(d)}
            type="button"
          >
            {d}
          </button>
        ))}
      </div>

      {workspace.schedules.length === 0 ? (
        <div className="empty-state">Nenhuma escala cadastrada ainda. Sem horário padrão o sistema não consegue avaliar se uma jornada ficou fora do esperado.</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Nome</th><th>Horário</th><th>Dias</th><th>HE programada</th><th></th></tr>
            </thead>
            <tbody>
              {workspace.schedules.map((s) => (
                <tr key={s.id}>
                  <td className="cell-strong">{s.nome}</td>
                  <td className="mono">{s.entrada}–{s.saida}</td>
                  <td className="cell-muted">{s.diasTrabalhados.join(', ')}</td>
                  <td>{s.heProgramadaMin}min</td>
                  <td>
                    <button className="btn btn-sm btn-danger" onClick={() => remover(s.id)} disabled={!podeEditar}><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
