import { useState } from 'react';
import { Trash2, AlertCircle } from 'lucide-react';
import type { Department } from '../../domain';
import { novoId, type TabProps } from './types';
import { FeedbackGravacao } from '../../components/ui/EstadosAsync';

export function SetoresTab({ workspace, gravar, gravacao, recarregar, podeEditar }: TabProps) {
  const [rascunho, setRascunho] = useState({ nome: '', unidadeId: '', responsavel: '' });
  const [erro, setErro] = useState<string | null>(null);

  async function adicionar() {
    const nome = rascunho.nome.trim();
    if (!nome) {
      setErro('Informe o nome do setor.');
      return;
    }
    /* O que fica gravado num caso é o NOME do setor, não o id — dois setores homônimos seriam
     * indistinguíveis na hora de classificar uma pendência e na análise por setor. */
    const jaExiste = workspace.departments.some((d) => d.nome.trim().toLowerCase() === nome.toLowerCase());
    if (jaExiste) {
      setErro(`Já existe um setor chamado "${nome}".`);
      return;
    }
    setErro(null);
    const novo: Department = { id: novoId('set'), nome, unidadeId: rascunho.unidadeId || null, responsavel: rascunho.responsavel };
    const ok = await gravacao.executar(() => gravar((repo, ctx) => repo.salvarSetor(ctx.empresaId, novo, ctx.versao)));
    if (ok !== null) setRascunho({ nome: '', unidadeId: '', responsavel: '' });
  }

  function remover(id: string) {
    void gravacao.executar(() => gravar((repo, ctx) => repo.excluirSetor(ctx.empresaId, id, ctx.versao)));
  }

  const nomeUnidade = (id: string | null) => workspace.units.find((u) => u.id === id)?.nome ?? '—';

  return (
    <div className="card card-pad">
      <div className="card-title">Setores</div>
      <p className="text-muted" style={{ fontSize: 12.5, marginTop: -8, marginBottom: 14 }}>
        O nome de cada setor cadastrado aqui vira automaticamente uma opção ao atribuir responsável
        numa pendência (aqui na tela e dentro do Assistente HE Diário) — não existe uma lista
        separada pra manter sincronizada.
      </p>
      <div className="toolbar" style={{ alignItems: 'flex-end' }}>
        <div>
          <div className="kpi-label" style={{ marginBottom: 6 }}>Nome</div>
          <input className="input" value={rascunho.nome} onChange={(e) => setRascunho((r) => ({ ...r, nome: e.target.value }))} placeholder="Operacional, Trânsito..." />
        </div>
        <div>
          <div className="kpi-label" style={{ marginBottom: 6 }}>Unidade</div>
          <select className="select" value={rascunho.unidadeId} onChange={(e) => setRascunho((r) => ({ ...r, unidadeId: e.target.value }))}>
            <option value="">—</option>
            {workspace.units.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </div>
        <div>
          <div className="kpi-label" style={{ marginBottom: 6 }}>Responsável</div>
          <input className="input" value={rascunho.responsavel} onChange={(e) => setRascunho((r) => ({ ...r, responsavel: e.target.value }))} placeholder="Nome do responsável" />
        </div>
        <button className="btn btn-primary" onClick={() => void adicionar()} disabled={!podeEditar || gravacao.estado === 'salvando'}>Adicionar</button>
        <FeedbackGravacao estado={gravacao.estado} erro={gravacao.erro} aoRecarregar={() => void recarregar()} />
      </div>

      {erro && (
        <div className="aviso-config" style={{ marginTop: 12 }}>
          <AlertCircle size={14} />
          <span>{erro}</span>
        </div>
      )}

      {workspace.departments.length === 0 ? (
        <div className="empty-state">Nenhum setor cadastrado ainda. Os setores aqui são as opções oferecidas ao classificar uma pendência e ao agrupar a análise.</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Nome</th><th>Unidade</th><th>Responsável</th><th></th></tr>
            </thead>
            <tbody>
              {workspace.departments.map((d) => (
                <tr key={d.id}>
                  <td className="cell-strong">{d.nome}</td>
                  <td>{nomeUnidade(d.unidadeId)}</td>
                  <td>{d.responsavel || '—'}</td>
                  <td>
                    <button className="btn btn-sm btn-danger" onClick={() => remover(d.id)} disabled={!podeEditar}><Trash2 size={13} /></button>
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
