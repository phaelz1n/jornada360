import { useEffect, useState } from 'react';
import type { TabProps } from './types';
import { FeedbackGravacao } from '../../components/ui/EstadosAsync';

export function EmpresaTab({ workspace, gravar, gravacao, recarregar, podeEditar }: TabProps) {
  const [form, setForm] = useState(workspace.company);

  /* Mantem o formulario alinhado com o que o servidor confirmou — inclusive quando uma gravacao
   * e recusada por conflito e a pessoa recarrega. */
  useEffect(() => setForm(workspace.company), [workspace.company]);

  function salvar() {
    void gravacao.executar(() => gravar((repo, ctx) => repo.salvarEmpresa(ctx.empresaId, form, ctx.versao)));
  }

  return (
    <div className="card card-pad" style={{ maxWidth: 560 }}>
      <div className="card-title">Dados da empresa</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div className="kpi-label" style={{ marginBottom: 6 }}>Nome</div>
          <input className="input" style={{ width: '100%' }} value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Nome da empresa" />
        </div>
        <div>
          <div className="kpi-label" style={{ marginBottom: 6 }}>CNPJ</div>
          <input className="input" style={{ width: '100%' }} value={form.cnpj} onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))} placeholder="00.000.000/0000-00" />
        </div>
        <div>
          <div className="kpi-label" style={{ marginBottom: 6 }}>Identificação (código interno, opcional)</div>
          <input className="input" style={{ width: '100%' }} value={form.identificacao} onChange={(e) => setForm((f) => ({ ...f, identificacao: e.target.value }))} />
        </div>
        <div>
          <div className="kpi-label" style={{ marginBottom: 6 }}>URL do logo (opcional)</div>
          <input className="input" style={{ width: '100%' }} value={form.logoUrl} onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))} placeholder="https://..." />
        </div>
        <div>
          <div className="kpi-label" style={{ marginBottom: 6 }}>Status</div>
          <select className="select" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as 'ativo' | 'inativo' }))}>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn btn-primary" onClick={salvar} disabled={!podeEditar || gravacao.estado === 'salvando'}>Salvar</button>
          <FeedbackGravacao estado={gravacao.estado} erro={gravacao.erro} aoRecarregar={() => void recarregar()} />
        </div>
      </div>
    </div>
  );
}
