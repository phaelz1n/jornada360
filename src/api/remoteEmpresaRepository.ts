/* Implementação REMOTA dos repositórios de cadastro.
 *
 * Prova concreta da promessa da arquitetura em camadas: o contrato é o mesmo dos repositórios
 * locais (listar/salvar/excluir por entidade, sempre com o id da empresa como primeiro
 * argumento), e só a implementação mudou — `localStorage` virou `fetch`.
 *
 * A única diferença visível no contrato é a assinatura: os métodos devolvem `Promise`. Essa é a
 * mudança real e inevitável da migração, e está documentada em SAAS_ARCHITECTURE.md § 4.
 *
 * Segurança: nenhum método envia `tenantId` no CORPO da requisição — ele vai na URL, e o servidor
 * valida contra as memberships da sessão antes de responder. Mandar o tenant no corpo seria pedir
 * ao servidor para confiar no cliente, que é exatamente o que o backend recusa fazer. */
import { api } from './client';
import type { Company, Department, Employee, IntegrationConfig, Rules, Schedule, Unit } from '../domain';

function base(tenantId: string): string {
  return `/api/tenants/${encodeURIComponent(tenantId)}`;
}

/* Carga completa do cadastro numa requisição só. É o que uma tela de configuração precisa ao
 * abrir — pedir sete endpoints separados geraria sete estados de carregamento na mesma tela. */
export interface CadastroRemoto {
  id: string;
  environment: 'real' | 'demo';
  papel: string;
  company: Company;
  units: Unit[];
  departments: Department[];
  schedules: Schedule[];
  employees: Employee[];
  integrations: IntegrationConfig[];
  users: { id: string; nome: string; email: string; papel: string }[];
  rules: Rules;
  causaOpts: string[];
}

export const RemoteEmpresaRepository = {
  carregarTudo(tenantId: string): Promise<CadastroRemoto> {
    return api.get<CadastroRemoto>(base(tenantId));
  },

  salvarEmpresa(tenantId: string, empresa: Company): Promise<Company> {
    return api.put<Company>(`${base(tenantId)}/empresa`, empresa);
  },

  listarUnidades(tenantId: string): Promise<Unit[]> {
    return api.get<Unit[]>(`${base(tenantId)}/unidades`);
  },
  salvarUnidade(tenantId: string, unidade: Unit): Promise<Unit> {
    return api.post<Unit>(`${base(tenantId)}/unidades`, unidade);
  },
  excluirUnidade(tenantId: string, id: string): Promise<void> {
    return api.delete<void>(`${base(tenantId)}/unidades/${encodeURIComponent(id)}`);
  },

  listarSetores(tenantId: string): Promise<Department[]> {
    return api.get<Department[]>(`${base(tenantId)}/setores`);
  },
  salvarSetor(tenantId: string, setor: Department): Promise<Department> {
    return api.post<Department>(`${base(tenantId)}/setores`, setor);
  },
  excluirSetor(tenantId: string, id: string): Promise<void> {
    return api.delete<void>(`${base(tenantId)}/setores/${encodeURIComponent(id)}`);
  },

  listarEscalas(tenantId: string): Promise<Schedule[]> {
    return api.get<Schedule[]>(`${base(tenantId)}/escalas`);
  },
  salvarEscala(tenantId: string, escala: Schedule): Promise<Schedule> {
    return api.post<Schedule>(`${base(tenantId)}/escalas`, escala);
  },
  excluirEscala(tenantId: string, id: string): Promise<void> {
    return api.delete<void>(`${base(tenantId)}/escalas/${encodeURIComponent(id)}`);
  },

  listarColaboradores(tenantId: string): Promise<Employee[]> {
    return api.get<Employee[]>(`${base(tenantId)}/colaboradores`);
  },
  salvarColaborador(tenantId: string, colaborador: Employee): Promise<Employee> {
    return api.post<Employee>(`${base(tenantId)}/colaboradores`, colaborador);
  },
  excluirColaborador(tenantId: string, id: string): Promise<void> {
    return api.delete<void>(`${base(tenantId)}/colaboradores/${encodeURIComponent(id)}`);
  },

  obterRegras(tenantId: string): Promise<{ regras: Rules; causaOpts: string[] }> {
    return api.get(`${base(tenantId)}/regras`);
  },
  salvarRegras(tenantId: string, dados: { regras: Rules; causaOpts: string[] }): Promise<{ regras: Rules; causaOpts: string[] }> {
    return api.put(`${base(tenantId)}/regras`, dados);
  },
};

/* Dados operacionais. O snapshot do motor viaja como JSON opaco — o servidor não o interpreta,
 * exatamente para que o motor HE continue intocado (ver server/repositories/operacaoRepository.js). */
export const RemoteOperacaoRepository = {
  listarDatas(tenantId: string): Promise<string[]> {
    return api.get<string[]>(`${base(tenantId)}/dias`);
  },

  obterDia(tenantId: string, dateKey: string): Promise<{ dateKey: string; snapshot: unknown; caseState: Record<string, unknown> }> {
    return api.get(`${base(tenantId)}/dias/${encodeURIComponent(dateKey)}`);
  },

  salvarDia(tenantId: string, dateKey: string, snapshot: unknown, caseState?: Record<string, unknown>) {
    return api.put(`${base(tenantId)}/dias/${encodeURIComponent(dateKey)}`, { snapshot, caseState });
  },

  atualizarCaso(tenantId: string, dateKey: string, chaveColaborador: string, patch: Record<string, unknown>) {
    return api.patch(
      `${base(tenantId)}/dias/${encodeURIComponent(dateKey)}/casos/${encodeURIComponent(chaveColaborador)}`,
      patch,
    );
  },

  listarPendencias(tenantId: string) {
    return api.get(`${base(tenantId)}/pendencias`);
  },

  salvarPendencia(tenantId: string, pendencia: { id: string }) {
    return api.put(`${base(tenantId)}/pendencias/${encodeURIComponent(pendencia.id)}`, pendencia);
  },

  /* Revisão é rota própria porque exige permissão separada (`pendencia:revisar`) e porque o autor
   * é resolvido pela sessão no servidor — o cliente não escolhe quem aprovou. */
  revisarPendencia(tenantId: string, id: string, decisao: 'aprovado' | 'reprovado', observacao?: string) {
    return api.post(`${base(tenantId)}/pendencias/${encodeURIComponent(id)}/revisao`, { decisao, observacao });
  },

  listarAuditoria(tenantId: string) {
    return api.get(`${base(tenantId)}/auditoria`);
  },
};
