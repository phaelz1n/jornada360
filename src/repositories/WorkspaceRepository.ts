import { APP_PREFIX, readJSON, removeKey, writeJSON } from './localStorageClient';
import { novoWorkspace, regrasPadrao, type Rules, type UserAccess, type IntegrationConfig, type WorkspaceConfig } from '../domain';

const WORKSPACES_KEY = `${APP_PREFIX}workspaces`;
const ACTIVE_KEY = `${APP_PREFIX}activeWorkspaceId`;

/* Dono da lista de workspaces (empresas configuradas) e de qual está ativo. Todo o resto do app
 * (repositórios, serviços, telas) trata "workspace ativo" como a única fonte de verdade de
 * "qual empresa estou vendo agora" — nunca há empresa implícita hardcoded. */
export const WorkspaceRepository = {
  /* `regrasPadrao()` espalhado ANTES de `w.rules` garante que um workspace persistido antes de um
   * campo novo existir (ex.: `prazoPadraoDias`/`alertaAntecedenciaDias`, Fase 2 Etapa 6/7) ganhe o
   * default na leitura, sem nunca sobrescrever um valor que o usuário já tenha configurado. */
  listAll(): WorkspaceConfig[] {
    return readJSON<WorkspaceConfig[]>(WORKSPACES_KEY, []).map((w) => ({
      ...w,
      rules: { ...regrasPadrao(), ...w.rules },
    }));
  },

  save(all: WorkspaceConfig[]): void {
    writeJSON(WORKSPACES_KEY, all);
  },

  getById(id: string): WorkspaceConfig | undefined {
    return this.listAll().find((w) => w.id === id);
  },

  upsert(workspace: WorkspaceConfig): void {
    const all = this.listAll();
    const idx = all.findIndex((w) => w.id === workspace.id);
    if (idx >= 0) all[idx] = workspace;
    else all.push(workspace);
    this.save(all);
  },

  getActiveId(): string | null {
    return localStorage.getItem(ACTIVE_KEY);
  },

  setActiveId(id: string): void {
    localStorage.setItem(ACTIVE_KEY, id);
  },

  updateRules(workspaceId: string, rules: Rules): void {
    const ws = this.getById(workspaceId);
    if (!ws) return;
    this.upsert({ ...ws, rules });
  },

  updateCausaOpts(workspaceId: string, causaOpts: string[]): void {
    const ws = this.getById(workspaceId);
    if (!ws) return;
    this.upsert({ ...ws, causaOpts });
  },

  updateIntegrations(workspaceId: string, integrations: IntegrationConfig[]): void {
    const ws = this.getById(workspaceId);
    if (!ws) return;
    this.upsert({ ...ws, integrations });
  },

  updateUsers(workspaceId: string, users: UserAccess[]): void {
    const ws = this.getById(workspaceId);
    if (!ws) return;
    this.upsert({ ...ws, users });
  },

  /* Cria uma empresa nova (workspace) pela interface — nenhum código precisa ser alterado pra
   * atender um cliente novo. Nasce com `novoWorkspace()`, ou seja: cadastro vazio e regras nos
   * defaults neutros. NUNCA copia nada do workspace ativo — herdar a configuração da empresa
   * anterior em silêncio é exatamente o que a portabilidade proíbe.
   *
   * O ambiente é sempre 'real': 'demo' é reservado ao workspace de demonstração criado no
   * bootstrap, cujo seed fictício não deve poder ser disparado para uma empresa de verdade. */
  criar(nomeEmpresa: string): WorkspaceConfig {
    const id = `ws-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const ws = novoWorkspace(id, 'real', nomeEmpresa.trim() || 'Empresa sem nome');
    this.upsert(ws);
    return ws;
  },

  renomear(workspaceId: string, nomeEmpresa: string): void {
    const ws = this.getById(workspaceId);
    if (!ws) return;
    this.upsert({ ...ws, company: { ...ws.company, nome: nomeEmpresa } });
  },

  /* Remove a configuração do workspace. Os dados operacionais dele (dias processados, pendências)
   * vivem em outros namespaces e são apagados por quem chama — ver `workspaceService.excluirWorkspace`,
   * que orquestra a limpeza completa. Aqui não se apaga o que este repositório não é dono. */
  remover(workspaceId: string): void {
    this.save(this.listAll().filter((w) => w.id !== workspaceId));
  },

  limparAtivo(): void {
    removeKey(ACTIVE_KEY);
  },

  /* Bootstrap do primeiro acesso.
   *
   * REGRA CRÍTICA DE PRODUTO: quem abre o Jornada360 pela primeira vez NÃO cai automaticamente
   * dentro de uma empresa. Antes, o bootstrap criava `real` ("Minha Empresa") e já o deixava ativo —
   * o visitante entrava numa empresa que ele não criou, com um nome que não é dele. Agora o
   * bootstrap garante apenas o ambiente de DEMONSTRAÇÃO (que precisa existir para o botão
   * "Ver demonstração" funcionar) e devolve `activeId: null`, o que faz a aplicação mostrar a tela
   * de boas-vindas em vez de um workspace qualquer. Ver src/pages/BemVindo.tsx.
   *
   * COMPATIBILIDADE: quem já usava o sistema tem `real` criado e um `activeWorkspaceId` salvo —
   * esses dois continuam válidos e a pessoa entra direto onde estava, sem ver a tela de boas-vindas
   * e sem perder nada. `real` nunca é recriado nem apagado aqui; só deixou de ser criado do zero. */
  ensureBootstrap(): { all: WorkspaceConfig[]; activeId: string | null } {
    let all = this.listAll();

    if (!all.some((w) => w.id === 'demo')) {
      this.upsert(novoWorkspace('demo', 'demo', 'Jornada360 Demo'));
      all = this.listAll();
    }

    const salvo = this.getActiveId();
    const activeId = salvo && all.some((w) => w.id === salvo) ? salvo : null;
    if (salvo && !activeId) this.limparAtivo();

    return { all, activeId };
  },
};
