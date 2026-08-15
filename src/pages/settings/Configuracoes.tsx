import { useState } from 'react';
import { useGravacao } from '../../data/useRecurso';
import { useSearchParams } from 'react-router-dom';
import { useWorkspace } from '../../workspace/WorkspaceContext';
import { EmpresaTab } from './EmpresaTab';
import { UnidadesTab } from './UnidadesTab';
import { SetoresTab } from './SetoresTab';
import { ColaboradoresTab } from './ColaboradoresTab';
import { EscalasTab } from './EscalasTab';
import { RegrasTab } from './RegrasTab';
import { IntegracoesTab } from './IntegracoesTab';
import { UsuariosTab } from './UsuariosTab';
import { EmpresasTab } from './EmpresasTab';
import { MigracaoTab } from './MigracaoTab';

const TABS = [
  { id: 'empresas', label: 'Empresas' },
  { id: 'empresa', label: 'Empresa' },
  { id: 'unidades', label: 'Unidades' },
  { id: 'setores', label: 'Setores' },
  { id: 'colaboradores', label: 'Colaboradores' },
  { id: 'escalas', label: 'Escalas' },
  { id: 'regras', label: 'Regras' },
  { id: 'integracoes', label: 'Integrações' },
  { id: 'usuarios', label: 'Usuários' },
  { id: 'migracao', label: 'Migrar dados locais' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function ehTabValida(valor: string | null): valor is TabId {
  return !!valor && TABS.some((t) => t.id === valor);
}

export default function Configuracoes() {
  const { workspace, gravar, recarregar, pode } = useWorkspace();

  /* Um estado de gravação para a tela inteira: só um formulário está ativo por vez, e ter um por
   * aba seria oito cópias do mesmo comportamento. */
  const gravacao = useGravacao();
  const podeEditar = pode('config:escrever');
  const props = { workspace, gravar, gravacao, recarregar, podeEditar };

  /* `?aba=` permite que o painel de onboarding leve direto ao passo certo, em vez de largar a
   * pessoa na aba Empresa e obrigá-la a procurar. Só o estado inicial vem da URL: clicar nas abas
   * depois disso não reescreve o endereço, senão o botão Voltar do navegador viraria um histórico
   * de cliques em aba. */
  const [searchParams] = useSearchParams();
  const abaInicial = searchParams.get('aba');
  const [tab, setTab] = useState<TabId>(ehTabValida(abaInicial) ? abaInicial : 'empresa');

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Configurações</h1>
          <p className="page-subtitle">
            Empresa, unidades, setores, colaboradores, escalas e regras — nada disso fica fixo no código. Você está editando{' '}
            <b>{workspace.company.nome || workspace.id}</b>; as demais empresas não são afetadas.
          </p>
        </div>
      </div>

      <div className="filter-pill section-gap" style={{ flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'empresas' && <EmpresasTab />}
      {tab === 'empresa' && <EmpresaTab {...props} />}
      {tab === 'unidades' && <UnidadesTab {...props} />}
      {tab === 'setores' && <SetoresTab {...props} />}
      {tab === 'colaboradores' && <ColaboradoresTab {...props} />}
      {tab === 'escalas' && <EscalasTab {...props} />}
      {tab === 'regras' && <RegrasTab {...props} />}
      {tab === 'integracoes' && <IntegracoesTab {...props} />}
      {tab === 'usuarios' && <UsuariosTab {...props} />}
      {tab === 'migracao' && <MigracaoTab />}
    </>
  );
}
