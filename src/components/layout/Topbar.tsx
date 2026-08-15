import { useLocation, useNavigate } from 'react-router-dom';
import { DoorOpen, LogOut, RefreshCw } from 'lucide-react';
import { useWorkspace } from '../../workspace/WorkspaceContext';
import { useAuth } from '../../auth/AuthContext';

const TITLES: Record<string, string> = {
  '/': 'Dashboard Executivo',
  '/ponto': 'Controle de Ponto',
  '/he1': 'Horas Extras HE1',
  '/motor-he': 'Assistente HE Diário',
  '/reincidencia': 'Ranking de Reincidência',
  '/score': 'Score do Colaborador',
  '/pendencias': 'Pendências',
  '/centro-de-acoes': 'Centro de Ações',
  '/setores': 'Análise por Setor',
  '/relatorios': 'Relatórios',
  '/auditoria': 'Auditoria',
  '/importar': 'Importar Dados',
  '/configuracoes': 'Configurações',
};

export function Topbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { workspace, empresas, setWorkspaceAtivo, sairDoWorkspace, carregando, recarregar, modo, papel } = useWorkspace();
  const { usuario, sair } = useAuth();

  const title = TITLES[location.pathname] ?? 'Jornada360';
  const isDemo = workspace.environment === 'demo';

  /* Sair da conta é diferente de sair da empresa, e a interface precisa deixar isso claro: um
   * encerra a sessão no servidor, o outro só desfaz a escolha de onde estou trabalhando. */
  async function encerrarSessao() {
    sairDoWorkspace();
    await sair();
    navigate('/bem-vindo');
  }

  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="topbar-crumb">Jornada360 / {workspace.company.nome || 'empresa ainda sem nome'}</span>
        <span className="topbar-title">{title}</span>
      </div>
      <div className="topbar-controls">
        {isDemo && <span className="env-banner-demo">🟣 AMBIENTE DEMONSTRAÇÃO — dados fictícios</span>}

        {/* Recarga manual existe porque, com servidor, os dados podem ter mudado por outra pessoa
            enquanto esta tela estava aberta. */}
        {modo === 'remoto' && (
          <button
            className="btn btn-sm"
            onClick={() => void recarregar()}
            disabled={carregando}
            title="Buscar as alterações mais recentes do servidor"
          >
            <RefreshCw size={13} className={carregando ? 'girando' : undefined} />
          </button>
        )}

        <select
          className="select"
          value={workspace.id}
          onChange={(e) => setWorkspaceAtivo(e.target.value)}
          title="Trocar de empresa"
        >
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>
              {e.environment === 'demo' ? '🟣' : '🟢'} {e.nome || 'Empresa sem nome'}
            </option>
          ))}
        </select>

        {modo === 'remoto' && usuario && (
          <span className="topbar-usuario" title={`${usuario.email} — papel: ${papel}`}>
            {usuario.nome}
          </span>
        )}

        {/* Volta ao portão de entrada. Não apaga nada — só desfaz a escolha de empresa. */}
        <button className="btn btn-sm" onClick={sairDoWorkspace} title="Trocar de empresa">
          <DoorOpen size={13} />
        </button>

        {modo === 'remoto' && (
          <button className="btn btn-sm" onClick={() => void encerrarSessao()} title="Sair da conta">
            <LogOut size={13} />
          </button>
        )}
      </div>
    </header>
  );
}
