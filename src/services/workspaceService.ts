/* Ciclo de vida de um workspace (empresa configurada).
 *
 * Existe porque criar/excluir uma empresa toca MAIS DE UM storage: a configuração
 * (WorkspaceRepository), os dias processados pelo motor (TimeRecordRepository), as pendências
 * persistidas (PendingRepository) e a trilha de auditoria (AuditRepository). Deixar essa orquestração
 * na tela espalharia a regra "o que compõe uma empresa" pela interface — e um esquecimento aqui
 * significaria dado órfão de uma empresa já excluída aparecendo noutra.
 *
 * A tela chama só este service; nenhum repositório é chamado direto por ela para isso. */
import { WorkspaceRepository } from '../repositories/WorkspaceRepository';
import { TimeRecordRepository } from '../repositories/TimeRecordRepository';
import { PendingRepository } from '../repositories/PendingRepository';
import { AuditRepository } from '../repositories/AuditRepository';
import type { WorkspaceConfig } from '../domain';

/* Ids reservados.
 *
 * `demo` é o ambiente de demonstração: excluí-lo quebraria o botão "Ver demonstração" do portão de
 * entrada, que é parte do produto.
 *
 * `real` não é mais criado no bootstrap (ver WorkspaceRepository.ensureBootstrap) — instalações
 * novas não o têm. Continua protegido por compatibilidade: quem já usava o sistema tem os dados de
 * produção dele, e uma exclusão acidental ali seria irreversível. */
const IDS_PROTEGIDOS = ['real', 'demo'];

export function podeExcluir(workspaceId: string): boolean {
  return !IDS_PROTEGIDOS.includes(workspaceId);
}

export function motivoNaoPodeExcluir(workspaceId: string): string | null {
  if (workspaceId === 'real') return 'Este é o ambiente de produção original e não pode ser excluído.';
  if (workspaceId === 'demo') return 'O ambiente de Demonstração não pode ser excluído — ele é a cópia de apresentação do sistema.';
  return null;
}

/* Cria a empresa com cadastro vazio e regras nos defaults neutros. Nada é copiado do workspace
 * ativo: quem configura a empresa nova começa do zero, de propósito. */
export function criarWorkspace(nomeEmpresa: string): WorkspaceConfig {
  return WorkspaceRepository.criar(nomeEmpresa);
}

export function renomearWorkspace(workspaceId: string, nomeEmpresa: string): void {
  WorkspaceRepository.renomear(workspaceId, nomeEmpresa);
}

export interface ResultadoExclusao {
  ok: boolean;
  erro?: string;
  diasRemovidos: number;
}

/* Exclui a empresa e TUDO que pertence a ela, em todos os namespaces. */
export function excluirWorkspace(workspaceId: string): ResultadoExclusao {
  const erro = motivoNaoPodeExcluir(workspaceId);
  if (erro) return { ok: false, erro, diasRemovidos: 0 };

  const diasRemovidos = TimeRecordRepository.clearAll(workspaceId);
  PendingRepository.limparPendencias(workspaceId);
  AuditRepository.clear(workspaceId);
  WorkspaceRepository.remover(workspaceId);

  return { ok: true, diasRemovidos };
}

export interface ResumoWorkspace {
  id: string;
  nome: string;
  ambiente: WorkspaceConfig['environment'];
  diasProcessados: number;
  colaboradoresCadastrados: number;
  unidades: number;
  setores: number;
  /** Falta o mínimo para operar: sem isso o sistema não consegue julgar nenhuma jornada. */
  configuracaoPendente: string[];
}

/* Diagnóstico de "esta empresa está pronta para operar?" — usado na tela de Configurações para
 * guiar quem está montando uma empresa nova, em vez de deixar a pessoa descobrir o que falta só
 * quando um indicador aparece vazio. */
export function resumirWorkspace(ws: WorkspaceConfig, diasProcessados: number): ResumoWorkspace {
  const pendente: string[] = [];
  if (!ws.company.nome.trim()) pendente.push('Nome da empresa');
  if (ws.units.length === 0) pendente.push('Pelo menos uma unidade');
  if (ws.departments.length === 0) pendente.push('Pelo menos um setor');
  if (ws.employees.length === 0) pendente.push('Colaboradores cadastrados');
  if (ws.schedules.length === 0) pendente.push('Pelo menos uma escala');
  if (ws.users.length === 0) pendente.push('Pelo menos um usuário');

  return {
    id: ws.id,
    nome: ws.company.nome,
    ambiente: ws.environment,
    diasProcessados,
    colaboradoresCadastrados: ws.employees.length,
    unidades: ws.units.length,
    setores: ws.departments.length,
    configuracaoPendente: pendente,
  };
}
