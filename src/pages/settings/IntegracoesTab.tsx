import type { IntegrationStatus } from '../../domain';
import type { TabProps } from './types';
import { FeedbackGravacao } from '../../components/ui/EstadosAsync';

export function IntegracoesTab({ workspace, gravar, gravacao, recarregar, podeEditar }: TabProps) {
  function alternarStatus(id: string, atual: IntegrationStatus) {
    const status: IntegrationStatus = atual === 'configurado' ? 'nao_configurado' : 'configurado';
    void gravacao.executar(() => gravar((repo, ctx) => repo.salvarIntegracao(ctx.empresaId, id, status, ctx.versao)));
  }

  return (
    <div className="card card-pad">
      <div className="card-title">Integrações</div>
      <p className="text-muted" style={{ fontSize: 12.5, marginTop: -8, marginBottom: 14 }}>
        Nenhuma credencial é digitada ou guardada aqui — isto é só o cadastro de quais fontes esta
        empresa usa. Credencial de integração mora no <b>servidor</b>, em variável de ambiente, e nunca
        chega ao navegador. Conectar de verdade (API da Cobli, API do sistema de ponto) é implementado
        por adapter (ver <code>src/integrations/</code> e INTEGRATIONS.md); hoje só a importação de
        arquivo tem funcionamento real.
      </p>
      <div style={{ marginBottom: 10 }}>
        <FeedbackGravacao estado={gravacao.estado} erro={gravacao.erro} aoRecarregar={() => void recarregar()} />
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr><th>Integração</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {workspace.integrations.map((i) => (
              <tr key={i.id}>
                <td className="cell-strong">{i.nome}</td>
                <td>
                  <span className={`badge ${i.status === 'configurado' ? 'badge-green' : 'badge-gray'}`}>
                    {i.status === 'configurado' ? 'Configurado' : 'Não configurado'}
                  </span>
                </td>
                <td>
                  {i.tipo !== 'excel_csv' && (
                    <button
                      className="btn btn-sm"
                      onClick={() => alternarStatus(i.id, i.status)}
                      disabled={!podeEditar || gravacao.estado === 'salvando'}
                    >
                      {i.status === 'configurado' ? 'Marcar como não configurado' : 'Marcar como configurado'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
