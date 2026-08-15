import { useState } from 'react';
import { Trash2, AlertCircle } from 'lucide-react';
import type { Unit } from '../../domain';
import { novoId, type TabProps } from './types';
import { FeedbackGravacao } from '../../components/ui/EstadosAsync';

export function UnidadesTab({ workspace, gravar, gravacao, recarregar, podeEditar }: TabProps) {
  const [rascunho, setRascunho] = useState({ nome: '', codigo: '', localizacao: '' });
  const [erro, setErro] = useState<string | null>(null);

  async function adicionar() {
    const nome = rascunho.nome.trim();
    if (!nome) {
      setErro('Informe o nome da unidade.');
      return;
    }
    /* Nomes de unidade aparecem lado a lado no Dashboard Executivo; dois iguais tornariam as duas
     * linhas indistinguíveis para quem lê o comparativo. */
    if (workspace.units.some((u) => u.nome.trim().toLowerCase() === nome.toLowerCase())) {
      setErro(`Já existe uma unidade chamada "${nome}".`);
      return;
    }
    setErro(null);
    const nova: Unit = { id: novoId('un'), ...rascunho, nome };
    const ok = await gravacao.executar(() => gravar((repo, ctx) => repo.salvarUnidade(ctx.empresaId, nova, ctx.versao)));
    /* O rascunho so e limpo quando a gravacao foi confirmada. Limpar antes faria a pessoa
     * perder o que digitou justamente quando algo deu errado. */
    if (ok !== null) setRascunho({ nome: '', codigo: '', localizacao: '' });
  }

  function remover(id: string) {
    void gravacao.executar(() => gravar((repo, ctx) => repo.excluirUnidade(ctx.empresaId, id, ctx.versao)));
  }

  return (
    <div className="card card-pad">
      <div className="card-title">Unidades</div>
      <div className="toolbar" style={{ alignItems: 'flex-end' }}>
        <div>
          <div className="kpi-label" style={{ marginBottom: 6 }}>Nome</div>
          <input className="input" value={rascunho.nome} onChange={(e) => setRascunho((r) => ({ ...r, nome: e.target.value }))} placeholder="Matriz, Filial SP..." />
        </div>
        <div>
          <div className="kpi-label" style={{ marginBottom: 6 }}>Código</div>
          <input className="input" value={rascunho.codigo} onChange={(e) => setRascunho((r) => ({ ...r, codigo: e.target.value }))} placeholder="UN01" />
        </div>
        <div>
          <div className="kpi-label" style={{ marginBottom: 6 }}>Localização</div>
          <input className="input" value={rascunho.localizacao} onChange={(e) => setRascunho((r) => ({ ...r, localizacao: e.target.value }))} placeholder="Cidade/UF" />
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

      {workspace.units.length === 0 ? (
        <div className="empty-state">Nenhuma unidade cadastrada ainda. As unidades permitem comparar filiais/bases entre si no Dashboard Executivo.</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Nome</th><th>Código</th><th>Localização</th><th></th></tr>
            </thead>
            <tbody>
              {workspace.units.map((u) => (
                <tr key={u.id}>
                  <td className="cell-strong">{u.nome}</td>
                  <td className="mono">{u.codigo}</td>
                  <td>{u.localizacao}</td>
                  <td>
                    <button className="btn btn-sm btn-danger" onClick={() => remover(u.id)} disabled={!podeEditar}><Trash2 size={13} /></button>
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
