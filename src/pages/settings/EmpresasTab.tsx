/* Gestão das empresas às quais você tem acesso.
 *
 * FASE 4 — o que mudou: a lista deixou de ser "empresas configuradas neste navegador" e passou a
 * ser "empresas às quais esta CONTA tem acesso", segundo o servidor. A diferença é a essência do
 * multiempresa: ninguém enxerga a empresa de outra pessoa, e não adianta adivinhar um identificador —
 * o servidor recusa (com 404, sem sequer confirmar que ela existe).
 *
 * O diagnóstico de prontidão só é possível para a empresa ATIVA, porque o cadastro das outras não
 * está carregado — e buscá-lo exigiria pedir ao servidor o conteúdo de todas as empresas para
 * preencher uma coluna informativa. Mostrar "—" e explicar é mais honesto do que baixar tudo. */
import { useMemo, useState } from 'react';
import { Plus, Trash2, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useWorkspace } from '../../workspace/WorkspaceContext';
import { useAuth, mensagemDeErro } from '../../auth/AuthContext';
import { resumirWorkspace } from '../../services/workspaceService';
import { PAPEL_LABEL, normalizarPapel } from '../../domain';
import { api } from '../../api/client';

export function EmpresasTab() {
  const { workspace, workspaceIdAtivo, empresas, setWorkspaceAtivo, sairDoWorkspace, dias, modo, pode } = useWorkspace();
  const { criarEmpresa, recarregarSessao } = useAuth();

  const [nomeNovo, setNomeNovo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  /* Só a empresa ativa tem cadastro carregado — ver comentário do topo. */
  const resumoAtiva = useMemo(() => resumirWorkspace(workspace, dias.length), [workspace, dias.length]);

  async function adicionar() {
    const nome = nomeNovo.trim();
    if (!nome) return setErro('Informe o nome da empresa.');
    if (ocupado) return;

    setErro(null);
    setOcupado(true);
    try {
      const t = await criarEmpresa(nome);
      setNomeNovo('');
      setWorkspaceAtivo(t.id);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setOcupado(false);
    }
  }

  /* Excluir é irreversível e apaga tudo da empresa em cascata no banco. Por isso: confirmação
   * explícita, e só para quem tem a permissão — que o servidor verifica de novo. */
  async function remover(id: string, nome: string) {
    const ok = window.confirm(
      `Excluir a empresa "${nome}"?\n\nIsso apaga definitivamente, no servidor, a configuração dela, todos os dias processados, as pendências e a trilha de auditoria. Esta ação não pode ser desfeita.`,
    );
    if (!ok) return;

    setOcupado(true);
    try {
      await api.delete(`/api/tenants/${encodeURIComponent(id)}`);
      if (id === workspaceIdAtivo) sairDoWorkspace();
      await recarregarSessao();
      setErro(null);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setOcupado(false);
    }
  }

  const podeExcluirEmpresa = pode('tenant:excluir');

  return (
    <div className="card card-pad">
      <div className="card-title">Empresas em que você tem acesso</div>
      <p className="text-muted" style={{ fontSize: 12.5, lineHeight: 1.55, marginTop: 0 }}>
        Cada empresa é um ambiente completamente separado: cadastro, regras, dados de ponto, pendências e auditoria
        próprios. Uma empresa nova nasce vazia, com as regras nos valores padrão — nunca herda a configuração de outra.
        {modo === 'remoto' && ' Esta lista vem do servidor, a partir da sua conta.'}
      </p>

      {modo === 'remoto' && (
        <div className="toolbar" style={{ marginTop: 14 }}>
          <input
            className="input"
            style={{ width: 280 }}
            placeholder="Nome da empresa nova…"
            value={nomeNovo}
            onChange={(e) => setNomeNovo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void adicionar()}
          />
          <button className="btn btn-primary" onClick={() => void adicionar()} disabled={ocupado}>
            {ocupado ? <Loader2 size={14} className="girando" /> : <Plus size={14} />}
            Criar empresa
          </button>
        </div>
      )}

      {erro && (
        <div className="aviso-config" style={{ marginTop: 12 }}>
          <AlertCircle size={14} />
          <span>{erro}</span>
        </div>
      )}

      <div className="table-wrap" style={{ marginTop: 14 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Ambiente</th>
              <th>Seu papel</th>
              <th>Situação</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {empresas.map((e) => {
              const ativa = e.id === workspaceIdAtivo;
              return (
                <tr key={e.id}>
                  <td>
                    <span className="cell-strong">{e.nome || e.id}</span>
                    {ativa && <span className="badge badge-green" style={{ marginLeft: 8 }}>Em uso</span>}
                  </td>
                  <td>
                    <span className={`badge ${e.environment === 'demo' ? 'badge-purple' : 'badge-blue'}`}>
                      {e.environment === 'demo' ? 'Demonstração' : 'Real'}
                    </span>
                  </td>
                  <td>{PAPEL_LABEL[normalizarPapel(e.papel)]}</td>
                  <td>
                    {!ativa ? (
                      <span className="cell-muted" title="O cadastro de outras empresas não é carregado enquanto você não entra nelas.">
                        —
                      </span>
                    ) : resumoAtiva.configuracaoPendente.length === 0 ? (
                      <span className="situacao-ok"><CheckCircle2 size={13} /> Pronta para operar</span>
                    ) : (
                      <span className="situacao-pendente" title={resumoAtiva.configuracaoPendente.join(' · ')}>
                        <AlertCircle size={13} /> Falta: {resumoAtiva.configuracaoPendente.join(', ')}
                      </span>
                    )}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {!ativa && (
                      <button className="btn btn-sm" onClick={() => setWorkspaceAtivo(e.id)}>Usar esta</button>
                    )}
                    {e.environment !== 'demo' && ativa && podeExcluirEmpresa && (
                      <button
                        className="btn btn-sm btn-danger"
                        style={{ marginLeft: 6 }}
                        onClick={() => void remover(e.id, e.nome || e.id)}
                        disabled={ocupado}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-faint" style={{ fontSize: 11.5, lineHeight: 1.5, marginTop: 12 }}>
        O ambiente de <b>Demonstração</b> é local, fictício e não pode ser excluído — ele é a cópia de apresentação do
        sistema e funciona mesmo sem servidor. Empresas criadas aqui nascem sempre como ambiente <b>Real</b>, com
        cadastro vazio: os dados da demonstração nunca são copiados para uma empresa de verdade. A situação só é
        calculada para a empresa em uso, porque o cadastro das demais não é carregado enquanto você não entra nelas.
      </p>
    </div>
  );
}
