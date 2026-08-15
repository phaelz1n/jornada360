import { useEffect, useState } from 'react';
import { Copy, Info, Trash2 } from 'lucide-react';
import { PAPEL_LABEL, type UserRole } from '../../domain';
import type { TabProps } from './types';
import { FeedbackGravacao } from '../../components/ui/EstadosAsync';
import { useSessao } from '../../workspace/WorkspaceContext';
import type { Convite, ConviteCriado } from '../../data/tipos';

const PAPEIS: UserRole[] = ['administrador', 'rh', 'gestor', 'auditor', 'colaborador'];

/* Gestão de acesso à empresa.
 *
 * FASE 4 — o que mudou: esta aba deixou de ser um cadastro decorativo. Cada linha aqui é um vínculo
 * REAL entre uma conta e esta empresa, e o papel escolhido é o que o servidor usa para autorizar (ou
 * recusar) cada requisição daquela pessoa. Mudar alguém de "RH" para "Auditor" tira dela a
 * capacidade de escrever — no servidor, não só na tela.
 *
 * DUAS SITUAÇÕES DIFERENTES, e a aba trata cada uma como tal:
 *  - a pessoa JÁ TEM conta → basta vincular pelo e-mail;
 *  - a pessoa AINDA NÃO TEM conta → é preciso um convite, porque criar conta por ela significaria
 *    definir a senha dela.
 *
 * O convite gera um código que aparece UMA vez. Não há envio por e-mail — não existe provedor
 * configurado, e um "enviamos um e-mail" que não envia nada seria pior do que a ausência do
 * recurso. Quem convida entrega o código pelo canal que já usa com a pessoa. */
export function UsuariosTab({ workspace, gravacao, recarregar, podeEditar }: TabProps) {
  const { repositorios, workspaceIdAtivo, modo, pode } = useSessao();

  const [vinculo, setVinculo] = useState({ email: '', papel: 'gestor' as UserRole });
  const [convite, setConvite] = useState({ email: '', papel: 'gestor' as UserRole });
  const [convites, setConvites] = useState<Convite[]>([]);
  const [codigoGerado, setCodigoGerado] = useState<ConviteCriado | null>(null);

  const podeGerir = modo === 'local' ? false : pode('usuarios:gerir');

  async function carregarConvites() {
    if (!workspaceIdAtivo || !podeGerir) return;
    try {
      setConvites(await repositorios.listarConvites(workspaceIdAtivo));
    } catch {
      /* Falta de permissão para ver convites não é erro de tela: a lista simplesmente não aparece. */
      setConvites([]);
    }
  }

  useEffect(() => {
    void carregarConvites();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega ao trocar de empresa
  }, [workspaceIdAtivo, podeGerir]);

  async function vincular() {
    if (!workspaceIdAtivo || !vinculo.email.trim()) return;
    const ok = await gravacao.executar(async () => {
      await repositorios.adicionarMembro(workspaceIdAtivo, vinculo.email.trim(), vinculo.papel);
      await recarregar();
    });
    if (ok !== null) setVinculo({ email: '', papel: 'gestor' });
  }

  async function gerarConvite() {
    if (!workspaceIdAtivo || !convite.email.trim()) return;
    const r = await gravacao.executar(() => repositorios.criarConvite(workspaceIdAtivo, convite.email.trim(), convite.papel));
    if (r) {
      setCodigoGerado(r);
      setConvite({ email: '', papel: 'gestor' });
      void carregarConvites();
    }
  }

  function alterarPapel(userId: string, papel: string) {
    if (!workspaceIdAtivo) return;
    void gravacao.executar(async () => {
      await repositorios.alterarPapel(workspaceIdAtivo, userId, papel);
      await recarregar();
    });
  }

  function remover(userId: string) {
    if (!workspaceIdAtivo) return;
    void gravacao.executar(async () => {
      await repositorios.removerMembro(workspaceIdAtivo, userId);
      await recarregar();
    });
  }

  function revogar(id: string) {
    if (!workspaceIdAtivo) return;
    void gravacao.executar(async () => {
      await repositorios.revogarConvite(workspaceIdAtivo, id);
      await carregarConvites();
    });
  }

  if (modo === 'local') {
    return (
      <div className="card card-pad">
        <div className="card-title">Usuários e papéis</div>
        <div className="aviso-config">
          <Info size={14} />
          <span>
            A demonstração não tem contas de acesso — ela roda sem servidor e sem login, para poder ser aberta em
            qualquer máquina. Numa empresa real, esta aba controla quem entra e o que cada pessoa pode fazer, com o
            servidor validando cada requisição.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="card card-pad">
      <div className="card-title">Usuários e papéis</div>
      <p className="text-muted" style={{ fontSize: 12.5, marginTop: -8, marginBottom: 14 }}>
        O papel escolhido aqui vale de verdade: o servidor verifica a permissão em cada requisição. Auditor lê e
        exporta mas não altera; Gestor trata pendências mas não aprova; só Administrador gere acessos e exclui a
        empresa.
      </p>

      {!podeGerir && (
        <div className="aviso-config" style={{ marginBottom: 14 }}>
          <Info size={14} />
          <span>Seu perfil pode ver quem tem acesso, mas não alterar. Só um administrador concede ou remove acesso.</span>
        </div>
      )}

      {podeGerir && (
        <>
          <div className="toolbar" style={{ alignItems: 'flex-end' }}>
            <div>
              <div className="kpi-label" style={{ marginBottom: 6 }}>E-mail de quem já tem conta</div>
              <input
                className="input"
                type="email"
                style={{ minWidth: 240 }}
                value={vinculo.email}
                onChange={(e) => setVinculo((v) => ({ ...v, email: e.target.value }))}
                placeholder="pessoa@empresa.com"
              />
            </div>
            <div>
              <div className="kpi-label" style={{ marginBottom: 6 }}>Papel</div>
              <select className="select" value={vinculo.papel} onChange={(e) => setVinculo((v) => ({ ...v, papel: e.target.value as UserRole }))}>
                {PAPEIS.map((p) => <option key={p} value={p}>{PAPEL_LABEL[p]}</option>)}
              </select>
            </div>
            <button className="btn btn-primary" onClick={() => void vincular()} disabled={gravacao.estado === 'salvando'}>
              Dar acesso
            </button>
            <FeedbackGravacao estado={gravacao.estado} erro={gravacao.erro} aoRecarregar={() => void recarregar()} />
          </div>

          <div className="toolbar" style={{ alignItems: 'flex-end', marginTop: 10 }}>
            <div>
              <div className="kpi-label" style={{ marginBottom: 6 }}>Convidar quem ainda não tem conta</div>
              <input
                className="input"
                type="email"
                style={{ minWidth: 240 }}
                value={convite.email}
                onChange={(e) => setConvite((v) => ({ ...v, email: e.target.value }))}
                placeholder="pessoa@empresa.com"
              />
            </div>
            <div>
              <div className="kpi-label" style={{ marginBottom: 6 }}>Papel</div>
              <select className="select" value={convite.papel} onChange={(e) => setConvite((v) => ({ ...v, papel: e.target.value as UserRole }))}>
                {PAPEIS.map((p) => <option key={p} value={p}>{PAPEL_LABEL[p]}</option>)}
              </select>
            </div>
            <button className="btn" onClick={() => void gerarConvite()} disabled={gravacao.estado === 'salvando'}>
              Gerar convite
            </button>
          </div>

          {codigoGerado && (
            <div className="aviso-config aviso-config--ok" style={{ marginTop: 12 }}>
              <Info size={14} />
              <div>
                <b>Convite para {codigoGerado.email}.</b> Copie o código e entregue à pessoa pelo canal que vocês já usam —
                o envio por e-mail ainda não existe, e este código <b>não será mostrado de novo</b>.
                <div className="codigo-convite">
                  <code>{codigoGerado.codigo}</code>
                  <button className="btn btn-sm" onClick={() => void navigator.clipboard?.writeText(codigoGerado.codigo)}>
                    <Copy size={13} /> Copiar
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <div className="table-wrap section-gap">
        <table className="data-table">
          <thead>
            <tr><th>Nome</th><th>Papel</th><th></th></tr>
          </thead>
          <tbody>
            {workspace.users.map((u) => (
              <tr key={u.id}>
                <td className="cell-strong">{u.nome}</td>
                <td>
                  {podeGerir ? (
                    <select className="select" value={u.papel} onChange={(e) => alterarPapel(u.id, e.target.value)}>
                      {PAPEIS.map((p) => <option key={p} value={p}>{PAPEL_LABEL[p]}</option>)}
                    </select>
                  ) : (
                    <span className="badge badge-blue">{PAPEL_LABEL[u.papel]}</span>
                  )}
                </td>
                <td>
                  <button className="btn btn-sm btn-danger" onClick={() => remover(u.id)} disabled={!podeGerir || !podeEditar}>
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {podeGerir && convites.length > 0 && (
        <div className="section-gap">
          <div className="kpi-label" style={{ marginBottom: 8 }}>Convites emitidos</div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>E-mail</th><th>Papel</th><th>Situação</th><th></th></tr>
              </thead>
              <tbody>
                {convites.map((c) => (
                  <tr key={c.id}>
                    <td className="cell-strong">{c.email}</td>
                    <td>{PAPEL_LABEL[c.papel as UserRole] ?? c.papel}</td>
                    <td>
                      {c.aceitoEm
                        ? <span className="badge badge-green">Aceito</span>
                        : new Date(c.expiraEm) <= new Date()
                          ? <span className="badge badge-gray">Expirado</span>
                          : <span className="badge badge-orange">Aguardando</span>}
                    </td>
                    <td>
                      {!c.aceitoEm && (
                        <button className="btn btn-sm btn-danger" onClick={() => revogar(c.id)}><Trash2 size={13} /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
