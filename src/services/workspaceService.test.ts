/* Ciclo de vida de empresa e ISOLAMENTO — o requisito mais crítico do produto.
 * Estes testes rodam sobre localStorage real (jsdom) porque é exatamente o isolamento de storage
 * que precisa ser provado, não uma abstração dele. */
import { describe, it, expect, beforeEach } from 'vitest';
import { WorkspaceRepository } from '../repositories/WorkspaceRepository';
import { EmployeeRepository } from '../repositories/EmployeeRepository';
import { DepartmentRepository } from '../repositories/DepartmentRepository';
import { TimeRecordRepository } from '../repositories/TimeRecordRepository';
import { PendingRepository } from '../repositories/PendingRepository';
import { AuditRepository } from '../repositories/AuditRepository';
import { criarWorkspace, excluirWorkspace, podeExcluir, resumirWorkspace } from './workspaceService';
import { regrasPadrao } from '../domain';
import { snapshot, itemRaw, pendencia } from '../testing/fixtures';

beforeEach(() => {
  localStorage.clear();
});

describe('workspaceService — criação de empresa', () => {
  it('cria a empresa com cadastro completamente vazio', () => {
    const ws = criarWorkspace('Empresa Nova');
    expect(ws.units).toHaveLength(0);
    expect(ws.departments).toHaveLength(0);
    expect(ws.employees).toHaveLength(0);
    expect(ws.schedules).toHaveLength(0);
  });

  it('cria a empresa com as regras nos defaults neutros', () => {
    // dailyGoalMin em 0 é o mais importante: o sistema nunca assume a meta de outra empresa.
    expect(criarWorkspace('Empresa Nova').rules).toEqual(regrasPadrao());
    expect(criarWorkspace('Outra').rules.dailyGoalMin).toBe(0);
  });

  it('cria sempre como ambiente real, nunca demo', () => {
    // É o que impede o seed fictício de alcançar uma empresa de verdade.
    expect(criarWorkspace('Empresa Nova').environment).toBe('real');
  });

  it('NÃO herda nada da empresa já existente', () => {
    const a = criarWorkspace('Empresa A');
    EmployeeRepository.upsert(a.id, { id: 'e1', nome: 'Alguém', matricula: '1', cargo: '', setorId: null, unidadeId: null, status: 'ativo', escalaId: null });
    DepartmentRepository.upsert(a.id, { id: 'd1', nome: 'Setor A', unidadeId: null, responsavel: '' });
    WorkspaceRepository.updateRules(a.id, { ...regrasPadrao(), toleranceMin: 45, dailyGoalMin: 999 });

    const b = criarWorkspace('Empresa B');
    expect(b.employees).toHaveLength(0);
    expect(b.departments).toHaveLength(0);
    expect(b.rules.toleranceMin).toBe(regrasPadrao().toleranceMin);
    expect(b.rules.dailyGoalMin).toBe(0);
  });
});

describe('workspaceService — isolamento entre empresas', () => {
  it('mantém cadastros separados por empresa', () => {
    const a = criarWorkspace('Empresa A');
    const b = criarWorkspace('Empresa B');
    EmployeeRepository.upsert(a.id, { id: 'e1', nome: 'Só da A', matricula: '1', cargo: '', setorId: null, unidadeId: null, status: 'ativo', escalaId: null });

    expect(EmployeeRepository.list(a.id)).toHaveLength(1);
    expect(EmployeeRepository.list(b.id)).toHaveLength(0);
  });

  it('mantém dias processados do motor separados por empresa', () => {
    const a = criarWorkspace('Empresa A');
    const b = criarWorkspace('Empresa B');
    TimeRecordRepository.saveSnapshot(a.id, snapshot('2026-08-01', [itemRaw({ motorista: 'Só da A' })]));

    expect(TimeRecordRepository.listDateKeys(a.id)).toHaveLength(1);
    expect(TimeRecordRepository.listDateKeys(b.id)).toHaveLength(0);
    expect(TimeRecordRepository.getSnapshot(b.id, '2026-08-01')).toBeNull();
  });

  it('mantém pendências separadas por empresa', () => {
    const a = criarWorkspace('Empresa A');
    const b = criarWorkspace('Empresa B');
    PendingRepository.criarPendencia(a.id, pendencia({ id: 'p1', workspaceId: a.id }));

    expect(PendingRepository.listarPorWorkspace(a.id)).toHaveLength(1);
    expect(PendingRepository.listarPorWorkspace(b.id)).toHaveLength(0);
    expect(PendingRepository.buscarPendencia(b.id, 'p1')).toBeNull();
  });

  it('mantém auditoria separada por empresa', () => {
    const a = criarWorkspace('Empresa A');
    const b = criarWorkspace('Empresa B');
    AuditRepository.add(a.id, { usuario: 'u', entidade: 'e', acao: 'a', valorAnterior: '', valorNovo: '', motivo: '' });

    expect(AuditRepository.list(a.id)).toHaveLength(1);
    expect(AuditRepository.list(b.id)).toHaveLength(0);
  });

  it('mantém regras separadas — mudar a tolerância de uma não afeta a outra', () => {
    const a = criarWorkspace('Empresa A');
    const b = criarWorkspace('Empresa B');
    WorkspaceRepository.updateRules(a.id, { ...regrasPadrao(), toleranceMin: 45 });

    expect(WorkspaceRepository.getById(a.id)?.rules.toleranceMin).toBe(45);
    expect(WorkspaceRepository.getById(b.id)?.rules.toleranceMin).toBe(10);
  });
});

describe('workspaceService — exclusão de empresa', () => {
  it('apaga TODOS os namespaces da empresa, sem deixar chave órfã', () => {
    const a = criarWorkspace('Empresa A');
    TimeRecordRepository.saveSnapshot(a.id, snapshot('2026-08-01', [itemRaw({})]));
    PendingRepository.criarPendencia(a.id, pendencia({ id: 'p1', workspaceId: a.id }));
    AuditRepository.add(a.id, { usuario: 'u', entidade: 'e', acao: 'a', valorAnterior: '', valorNovo: '', motivo: '' });

    expect(excluirWorkspace(a.id).ok).toBe(true);

    const orfas = Object.keys(localStorage).filter((k) => k.includes(a.id));
    expect(orfas).toEqual([]);
    expect(WorkspaceRepository.getById(a.id)).toBeUndefined();
  });

  it('não afeta as demais empresas ao excluir uma', () => {
    const a = criarWorkspace('Empresa A');
    const b = criarWorkspace('Empresa B');
    TimeRecordRepository.saveSnapshot(b.id, snapshot('2026-08-01', [itemRaw({})]));

    excluirWorkspace(a.id);

    expect(WorkspaceRepository.getById(b.id)).toBeDefined();
    expect(TimeRecordRepository.listDateKeys(b.id)).toHaveLength(1);
  });

  it('protege os ambientes reservados contra exclusão', () => {
    expect(podeExcluir('demo')).toBe(false);
    expect(podeExcluir('real')).toBe(false);
    expect(excluirWorkspace('demo').ok).toBe(false);
    expect(excluirWorkspace('demo').erro).toBeTruthy();
  });
});

describe('workspaceService — bootstrap do primeiro acesso', () => {
  it('não cria nenhuma empresa do cliente e não ativa nada', () => {
    // Requisito crítico de produto: ninguém entra numa empresa sem escolher.
    const boot = WorkspaceRepository.ensureBootstrap();
    expect(boot.activeId).toBeNull();
    expect(boot.all.filter((w) => w.environment !== 'demo')).toHaveLength(0);
  });

  it('garante o ambiente de demonstração para o botão "Ver demonstração" funcionar', () => {
    const boot = WorkspaceRepository.ensureBootstrap();
    expect(boot.all.find((w) => w.id === 'demo')?.environment).toBe('demo');
  });

  it('preserva a empresa ativa de quem já usava o sistema', () => {
    const a = criarWorkspace('Empresa A');
    WorkspaceRepository.setActiveId(a.id);
    expect(WorkspaceRepository.ensureBootstrap().activeId).toBe(a.id);
  });

  it('descarta empresa ativa que não existe mais, em vez de quebrar', () => {
    WorkspaceRepository.setActiveId('empresa-que-foi-apagada');
    expect(WorkspaceRepository.ensureBootstrap().activeId).toBeNull();
  });
});

describe('workspaceService.resumirWorkspace', () => {
  it('aponta tudo que falta numa empresa recém-criada', () => {
    const ws = criarWorkspace('Empresa Nova');
    const r = resumirWorkspace(ws, 0);
    expect(r.configuracaoPendente).toContain('Pelo menos uma unidade');
    expect(r.configuracaoPendente).toContain('Colaboradores cadastrados');
  });
});
