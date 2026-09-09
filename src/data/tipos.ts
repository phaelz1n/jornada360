/* Contratos da camada de dados do Jornada360.
 *
 * É o "único lugar que sabe onde os dados vivem" — o contrato estável entre as telas/services e
 * qualquer implementação de storage (localStorage, Firebase, REST API).
 *
 * A escolha de implementação acontece uma vez, em WorkspaceContext. Nenhuma tela pergunta
 * em qual modo está — ela só chama métodos desta interface. */
import type {
  WorkspaceConfig,
  Company,
  Unit,
  Department,
  Employee,
  Schedule,
  Rules,
  IntegrationStatus,
  UserRole,
  Pendencia,
} from '../domain';
import type { AuditEntry } from '../repositories/AuditRepository';

export interface Convite {
  id: string;
  email: string;
  papel: string;
  expiraEm: string;
  aceitoEm?: string | null;
}

export interface ConviteCriado {
  email: string;
  codigo: string;
}

/** Um dia processado pelo motor HE. */
export interface DiaBruto {
  dateKey: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  snapshot: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  caseState: Record<string, any>;
}

/** Estado completo de uma empresa carregado de uma vez — é o que WorkspaceContext expõe síncrono. */
export interface EstadoEmpresa {
  config: WorkspaceConfig;
  dias: DiaBruto[];
  pendencias: Pendencia[];
  auditoria: AuditEntry[];
  versao: string;
  papel: string;
  permissoes: string[];
}

/** Contrato único que toda implementação de storage deve satisfazer.
 *  Existem duas implementações: conjuntoLocal (localStorage) e conjuntoFirestore (Firebase). */
export interface ConjuntoRepositorios {
  /** 'local' = demonstração sem servidor | 'remoto' = empresa real com banco */
  readonly modo: 'local' | 'remoto';

  /** Carrega o estado completo da empresa de uma vez. */
  carregarTudo(workspaceId: string): Promise<EstadoEmpresa>;

  /* ---- cadastro geral ---- */
  atualizarCadastro(workspaceId: string, patch: Partial<Omit<WorkspaceConfig, 'id' | 'environment' | 'criadoEm'>>, versao?: string): Promise<void>;

  /* ---- tabs específicas de configuração ---- */
  salvarEmpresa(workspaceId: string, company: Partial<Company>, versao?: string): Promise<void>;
  salvarUnidade(workspaceId: string, unit: Unit, versao?: string): Promise<void>;
  excluirUnidade(workspaceId: string, id: string, versao?: string): Promise<void>;
  salvarSetor(workspaceId: string, sector: Department, versao?: string): Promise<void>;
  excluirSetor(workspaceId: string, id: string, versao?: string): Promise<void>;
  salvarColaborador(workspaceId: string, employee: Employee, versao?: string): Promise<void>;
  excluirColaborador(workspaceId: string, id: string, versao?: string): Promise<void>;
  salvarEscala(workspaceId: string, schedule: Schedule, versao?: string): Promise<void>;
  excluirEscala(workspaceId: string, id: string, versao?: string): Promise<void>;
  salvarRegras(workspaceId: string, rules: Rules, causaOpts: string[], versao?: string): Promise<void>;
  salvarIntegracao(workspaceId: string, id: string, status: IntegrationStatus, versao?: string): Promise<void>;

  /* ---- usuários e convites ---- */
  listarConvites(workspaceId: string): Promise<Convite[]>;
  criarConvite(workspaceId: string, email: string, papel: UserRole): Promise<ConviteCriado>;
  adicionarMembro(workspaceId: string, email: string, papel: UserRole): Promise<void>;
  alterarPapel(workspaceId: string, userId: string, papel: string): Promise<void>;
  removerMembro(workspaceId: string, userId: string): Promise<void>;
  revogarConvite(workspaceId: string, conviteId: string): Promise<void>;

  /* ---- dias processados ---- */
  salvarDia(workspaceId: string, diaOuDateKey: string | DiaBruto, snapshot?: unknown, caseState?: Record<string, unknown>): Promise<void>;
  atualizarCaso(workspaceId: string, dateKey: string, chaveColaborador: string, patch: Record<string, unknown>): Promise<void>;
  limparDias(workspaceId: string): Promise<void>;

  /* ---- pendências ---- */
  salvarPendencia(workspaceId: string, pendencia: Pendencia): Promise<void>;
  revisarPendencia(workspaceId: string, id: string, decisao: 'aprovado' | 'reprovado', observacao?: string | null): Promise<void>;

  /* ---- auditoria e relatórios ---- */
  registrarAuditoria(workspaceId: string, entry: Omit<AuditEntry, 'id' | 'timestamp'>): Promise<void>;
  registrarExportacao(workspaceId: string, tipo: string, formatoOuDescricao: string): Promise<void>;
}
