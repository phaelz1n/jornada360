/* Implementação LOCAL (localStorage) do ConjuntoRepositorios.
 *
 * Usada pelo modo demonstração: funciona sem servidor, sem conta, sem rede.
 * É uma camada fina sobre os repositórios existentes em src/repositories/ — não duplica lógica.
 *
 * A assinatura é assíncrona (retorna Promise) mesmo que localStorage seja síncrono.
 * Isso é deliberado: o contrato ConjuntoRepositorios é sempre async (a implementação Firebase
 * precisa ser), e manter um contrato síncrono no local forçaria cada chamador a tratar os dois
 * casos — que é o vazamento que a fábrica existe para impedir. */

import type { ConjuntoRepositorios, Convite, ConviteCriado, DiaBruto, EstadoEmpresa } from './tipos';
import type {
  WorkspaceConfig,
  Company,
  Unit,
  Department,
  Employee,
  Schedule,
  Rules,
  IntegrationStatus,
  Pendencia,
} from '../domain';
import { regrasPadrao } from '../domain';
import type { AuditEntry } from '../repositories/AuditRepository';
import { WorkspaceRepository } from '../repositories/WorkspaceRepository';
import { AuditRepository } from '../repositories/AuditRepository';
import { PendingRepository } from '../repositories/PendingRepository';
import { TimeRecordRepository } from '../repositories/TimeRecordRepository';
import type { HEDiaSnapshot } from '../engine/heEngineCore';

function carregarDias(workspaceId: string): DiaBruto[] {
  const dateKeys = TimeRecordRepository.listDateKeys(workspaceId);
  return dateKeys.map((dateKey) => ({
    dateKey,
    snapshot: TimeRecordRepository.getSnapshot(workspaceId, dateKey),
    caseState: TimeRecordRepository.getCaseState(workspaceId, dateKey),
  }));
}

export const conjuntoLocal: ConjuntoRepositorios = {
  modo: 'local',

  async carregarTudo(workspaceId: string): Promise<EstadoEmpresa> {
    const ws = WorkspaceRepository.getById(workspaceId);
    if (!ws) throw new Error(`Workspace "${workspaceId}" não encontrado no localStorage.`);

    // Aplica defaults de regras para campos adicionados em versões posteriores
    const config: WorkspaceConfig = {
      ...ws,
      rules: { ...regrasPadrao(), ...ws.rules },
    };

    const dias = carregarDias(workspaceId);
    const pendencias = PendingRepository.listarPorWorkspace(workspaceId);
    const auditoria = AuditRepository.list(workspaceId);

    return {
      config,
      dias,
      pendencias,
      auditoria,
      versao: '',       // localStorage não tem controle de versão (sem concorrência multiusuário)
      papel: 'administrador',
      permissoes: [],   // modo local: pode tudo (verificado em WorkspaceContext.pode)
    };
  },

  async atualizarCadastro(workspaceId: string, patch: Partial<Omit<WorkspaceConfig, 'id' | 'environment' | 'criadoEm'>>): Promise<void> {
    const ws = WorkspaceRepository.getById(workspaceId);
    if (!ws) return;
    WorkspaceRepository.upsert({ ...ws, ...patch });
  },

  async salvarEmpresa(workspaceId: string, company: Partial<Company>): Promise<void> {
    const ws = WorkspaceRepository.getById(workspaceId);
    if (!ws) return;
    WorkspaceRepository.upsert({ ...ws, company: { ...ws.company, ...company } });
  },

  async salvarUnidade(workspaceId: string, unit: Unit): Promise<void> {
    const ws = WorkspaceRepository.getById(workspaceId);
    if (!ws) return;
    const exists = ws.units.some((u) => u.id === unit.id);
    const units = exists ? ws.units.map((u) => (u.id === unit.id ? unit : u)) : [...ws.units, unit];
    WorkspaceRepository.upsert({ ...ws, units });
  },

  async excluirUnidade(workspaceId: string, id: string): Promise<void> {
    const ws = WorkspaceRepository.getById(workspaceId);
    if (!ws) return;
    WorkspaceRepository.upsert({ ...ws, units: ws.units.filter((u) => u.id !== id) });
  },

  async salvarSetor(workspaceId: string, sector: Department): Promise<void> {
    const ws = WorkspaceRepository.getById(workspaceId);
    if (!ws) return;
    const exists = ws.departments.some((d) => d.id === sector.id);
    const departments = exists ? ws.departments.map((d) => (d.id === sector.id ? sector : d)) : [...ws.departments, sector];
    WorkspaceRepository.upsert({ ...ws, departments });
  },

  async excluirSetor(workspaceId: string, id: string): Promise<void> {
    const ws = WorkspaceRepository.getById(workspaceId);
    if (!ws) return;
    WorkspaceRepository.upsert({ ...ws, departments: ws.departments.filter((d) => d.id !== id) });
  },

  async salvarColaborador(workspaceId: string, employee: Employee): Promise<void> {
    const ws = WorkspaceRepository.getById(workspaceId);
    if (!ws) return;
    const exists = ws.employees.some((e) => e.id === employee.id);
    const employees = exists ? ws.employees.map((e) => (e.id === employee.id ? employee : e)) : [...ws.employees, employee];
    WorkspaceRepository.upsert({ ...ws, employees });
  },

  async excluirColaborador(workspaceId: string, id: string): Promise<void> {
    const ws = WorkspaceRepository.getById(workspaceId);
    if (!ws) return;
    WorkspaceRepository.upsert({ ...ws, employees: ws.employees.filter((e) => e.id !== id) });
  },

  async salvarEscala(workspaceId: string, schedule: Schedule): Promise<void> {
    const ws = WorkspaceRepository.getById(workspaceId);
    if (!ws) return;
    const exists = ws.schedules.some((s) => s.id === schedule.id);
    const schedules = exists ? ws.schedules.map((s) => (s.id === schedule.id ? schedule : s)) : [...ws.schedules, schedule];
    WorkspaceRepository.upsert({ ...ws, schedules });
  },

  async excluirEscala(workspaceId: string, id: string): Promise<void> {
    const ws = WorkspaceRepository.getById(workspaceId);
    if (!ws) return;
    WorkspaceRepository.upsert({ ...ws, schedules: ws.schedules.filter((s) => s.id !== id) });
  },

  async salvarRegras(workspaceId: string, rules: Rules, causaOpts: string[]): Promise<void> {
    const ws = WorkspaceRepository.getById(workspaceId);
    if (!ws) return;
    WorkspaceRepository.upsert({ ...ws, rules, causaOpts });
  },

  async salvarIntegracao(workspaceId: string, id: string, status: IntegrationStatus): Promise<void> {
    const ws = WorkspaceRepository.getById(workspaceId);
    if (!ws) return;
    const integrations = ws.integrations.map((it) => (it.id === id ? { ...it, status } : it));
    WorkspaceRepository.upsert({ ...ws, integrations });
  },

  async listarConvites(): Promise<Convite[]> {
    return [];
  },

  async criarConvite(_workspaceId: string, email: string): Promise<ConviteCriado> {
    return { email, codigo: 'DEMO-CONVITE' };
  },

  async adicionarMembro(): Promise<void> {
    // Modo local não usa gestão de contas
  },

  async alterarPapel(): Promise<void> {
    // Modo local não usa gestão de contas
  },

  async removerMembro(): Promise<void> {
    // Modo local não usa gestão de contas
  },

  async revogarConvite(): Promise<void> {
    // Modo local não usa gestão de contas
  },

  async salvarDia(
    workspaceId: string,
    diaOuDateKey: string | DiaBruto,
    snapshot?: unknown,
  ): Promise<void> {
    if (typeof diaOuDateKey === 'object' && diaOuDateKey.snapshot) {
      TimeRecordRepository.saveSnapshot(workspaceId, diaOuDateKey.snapshot as HEDiaSnapshot);
    } else if (snapshot) {
      TimeRecordRepository.saveSnapshot(workspaceId, snapshot as HEDiaSnapshot);
    }
  },

  async atualizarCaso(workspaceId: string, dateKey: string, chaveColaborador: string, patch: Record<string, unknown>): Promise<void> {
    TimeRecordRepository.updateCase(workspaceId, dateKey, chaveColaborador, patch as Parameters<typeof TimeRecordRepository.updateCase>[3]);
  },

  async limparDias(workspaceId: string): Promise<void> {
    TimeRecordRepository.clearAll(workspaceId);
  },

  async salvarPendencia(workspaceId: string, pendencia: Pendencia): Promise<void> {
    PendingRepository.criarPendencia(workspaceId, pendencia);
  },

  async revisarPendencia(workspaceId: string, id: string, decisao: 'aprovado' | 'reprovado', observacao?: string | null): Promise<void> {
    PendingRepository.revisarPendencia(workspaceId, id, decisao, 'Demonstração', observacao ?? null);
  },

  async registrarAuditoria(workspaceId: string, entry: Omit<AuditEntry, 'id' | 'timestamp'>): Promise<void> {
    AuditRepository.add(workspaceId, entry);
  },

  async registrarExportacao(workspaceId: string, tipo: string, descricao: string): Promise<void> {
    AuditRepository.add(workspaceId, {
      usuario: 'Usuário Local',
      entidade: `Relatório: ${tipo}`,
      acao: 'Exportação realizada',
      valorAnterior: '—',
      valorNovo: descricao,
      motivo: 'Exportação de dados',
    });
  },
};
