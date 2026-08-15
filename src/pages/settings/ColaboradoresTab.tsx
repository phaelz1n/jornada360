import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Employee } from '../../domain';
import { novoId, type TabProps } from './types';
import { FeedbackGravacao } from '../../components/ui/EstadosAsync';

const STATUS_OPTS = ['ativo', 'inativo', 'afastado'] as const;

export function ColaboradoresTab({ workspace, gravar, gravacao, recarregar, podeEditar }: TabProps) {
  const [rascunho, setRascunho] = useState({
    nome: '',
    matricula: '',
    cargo: '',
    setorId: '',
    unidadeId: '',
    status: 'ativo' as Employee['status'],
    escalaId: '',
  });

  async function adicionar() {
    if (!rascunho.nome.trim()) return;
    const novo: Employee = {
      id: novoId('col'),
      nome: rascunho.nome,
      matricula: rascunho.matricula,
      cargo: rascunho.cargo,
      setorId: rascunho.setorId || null,
      unidadeId: rascunho.unidadeId || null,
      status: rascunho.status,
      escalaId: rascunho.escalaId || null,
    };
    const ok = await gravacao.executar(() => gravar((repo, ctx) => repo.salvarColaborador(ctx.empresaId, novo, ctx.versao)));
    if (ok !== null) setRascunho({ nome: '', matricula: '', cargo: '', setorId: '', unidadeId: '', status: 'ativo', escalaId: '' });
  }

  function remover(id: string) {
    void gravacao.executar(() => gravar((repo, ctx) => repo.excluirColaborador(ctx.empresaId, id, ctx.versao)));
  }

  const nomeSetor = (id: string | null) => workspace.departments.find((d) => d.id === id)?.nome ?? '—';
  const nomeEscala = (id: string | null) => workspace.schedules.find((s) => s.id === id)?.nome ?? '—';

  return (
    <div className="card card-pad">
      <div className="card-title">Colaboradores</div>
      <p className="text-muted" style={{ fontSize: 12.5, marginTop: -8, marginBottom: 14 }}>
        Este cadastro é o diretório de referência (cargo, setor, escala). O cruzamento diário de
        ponto/HE continua vindo do Assistente HE Diário — os nomes aqui não precisam bater 1:1 com
        o espelho de ponto para o motor funcionar.
      </p>
      <div className="toolbar" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <div className="kpi-label" style={{ marginBottom: 6 }}>Nome</div>
          <input className="input" value={rascunho.nome} onChange={(e) => setRascunho((r) => ({ ...r, nome: e.target.value }))} />
        </div>
        <div>
          <div className="kpi-label" style={{ marginBottom: 6 }}>Matrícula</div>
          <input className="input" style={{ width: 110 }} value={rascunho.matricula} onChange={(e) => setRascunho((r) => ({ ...r, matricula: e.target.value }))} />
        </div>
        <div>
          <div className="kpi-label" style={{ marginBottom: 6 }}>Cargo</div>
          <input className="input" value={rascunho.cargo} onChange={(e) => setRascunho((r) => ({ ...r, cargo: e.target.value }))} placeholder="Ex.: Analista, Operador, Motorista..." />
        </div>
        <div>
          <div className="kpi-label" style={{ marginBottom: 6 }}>Setor</div>
          <select className="select" value={rascunho.setorId} onChange={(e) => setRascunho((r) => ({ ...r, setorId: e.target.value }))}>
            <option value="">—</option>
            {workspace.departments.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
        </div>
        <div>
          <div className="kpi-label" style={{ marginBottom: 6 }}>Escala</div>
          <select className="select" value={rascunho.escalaId} onChange={(e) => setRascunho((r) => ({ ...r, escalaId: e.target.value }))}>
            <option value="">—</option>
            {workspace.schedules.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </div>
        <div>
          <div className="kpi-label" style={{ marginBottom: 6 }}>Status</div>
          <select className="select" value={rascunho.status} onChange={(e) => setRascunho((r) => ({ ...r, status: e.target.value as Employee['status'] }))}>
            {STATUS_OPTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={() => void adicionar()} disabled={!podeEditar || gravacao.estado === "salvando"}>Adicionar</button>
        <FeedbackGravacao estado={gravacao.estado} erro={gravacao.erro} aoRecarregar={() => void recarregar()} />
      </div>

      {workspace.employees.length === 0 ? (
        <div className="empty-state">Nenhum colaborador cadastrado ainda. Cadastre a equipe para que os registros de ponto possam ser ligados a setor e unidade nos indicadores.</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Nome</th><th>Matrícula</th><th>Cargo</th><th>Setor</th><th>Escala</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {workspace.employees.map((e) => (
                <tr key={e.id}>
                  <td className="cell-strong">{e.nome}</td>
                  <td className="mono">{e.matricula || '—'}</td>
                  <td>{e.cargo || '—'}</td>
                  <td>{nomeSetor(e.setorId)}</td>
                  <td>{nomeEscala(e.escalaId)}</td>
                  <td>
                    <span className={`badge ${e.status === 'ativo' ? 'badge-green' : e.status === 'afastado' ? 'badge-orange' : 'badge-gray'}`}>{e.status}</span>
                  </td>
                  <td>
                    <button className="btn btn-sm btn-danger" onClick={() => remover(e.id)} disabled={!podeEditar}><Trash2 size={13} /></button>
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
