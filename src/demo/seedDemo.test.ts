/* Blindagem do ambiente de demonstração — dado fictício NUNCA pode alcançar uma empresa real.
 * Ver DEMO.md § Os dados fictícios nunca saem da demonstração. */
import { describe, it, expect, beforeEach } from 'vitest';
import { seedDemoWorkspaceIfEmpty } from './seedDemo';
import { WorkspaceRepository } from '../repositories/WorkspaceRepository';
import { TimeRecordRepository } from '../repositories/TimeRecordRepository';
import { criarWorkspace } from '../services/workspaceService';
import { novoWorkspace } from '../domain';
import { snapshot, itemRaw } from '../testing/fixtures';

beforeEach(() => {
  localStorage.clear();
});

describe('seedDemo — trava por ambiente', () => {
  it('RECUSA semear uma empresa real, mesmo chamada explicitamente', () => {
    // A falha que este teste impede: 5 colaboradores inventados aparecerem dentro da
    // empresa de um cliente.
    const real = criarWorkspace('Empresa de Verdade');
    seedDemoWorkspaceIfEmpty(real.id);
    expect(TimeRecordRepository.listDateKeys(real.id)).toHaveLength(0);
    expect(WorkspaceRepository.getById(real.id)?.departments).toHaveLength(0);
  });

  it('RECUSA semear um workspace com id "demo" mas ambiente real', () => {
    // Não basta o id ser 'demo' — o que vale é o environment, porque é ele que estampa o
    // aviso roxo na interface.
    WorkspaceRepository.upsert(novoWorkspace('demo', 'real', 'Impostor'));
    seedDemoWorkspaceIfEmpty('demo');
    expect(TimeRecordRepository.listDateKeys('demo')).toHaveLength(0);
  });

  it('RECUSA semear um workspace inexistente', () => {
    seedDemoWorkspaceIfEmpty('nao-existe');
    expect(TimeRecordRepository.listDateKeys('nao-existe')).toHaveLength(0);
  });

  it('semeia o ambiente de demonstração de verdade', () => {
    WorkspaceRepository.upsert(novoWorkspace('demo', 'demo', 'Jornada360 Demo'));
    seedDemoWorkspaceIfEmpty('demo');
    expect(TimeRecordRepository.listDateKeys('demo').length).toBeGreaterThan(0);
    expect(WorkspaceRepository.getById('demo')?.departments.length).toBeGreaterThan(0);
  });

  it('não sobrescreve o que já existe na demonstração', () => {
    // Quem editou casos no Demo não deve perder o trabalho num reload.
    WorkspaceRepository.upsert(novoWorkspace('demo', 'demo', 'Jornada360 Demo'));
    TimeRecordRepository.saveSnapshot('demo', snapshot('2020-01-01', [itemRaw({ motorista: 'Preexistente' })]));
    seedDemoWorkspaceIfEmpty('demo');
    expect(TimeRecordRepository.listDateKeys('demo')).toEqual(['2020-01-01']);
  });

  it('não vaza dado da demonstração para uma empresa real criada depois', () => {
    WorkspaceRepository.upsert(novoWorkspace('demo', 'demo', 'Jornada360 Demo'));
    seedDemoWorkspaceIfEmpty('demo');

    const real = criarWorkspace('Empresa de Verdade');
    expect(TimeRecordRepository.listDateKeys(real.id)).toHaveLength(0);
    expect(WorkspaceRepository.getById(real.id)?.employees).toHaveLength(0);
    expect(WorkspaceRepository.getById(real.id)?.departments).toHaveLength(0);
    // A meta de exemplo aplicada ao Demo não pode contaminar a empresa nova.
    expect(WorkspaceRepository.getById(real.id)?.rules.dailyGoalMin).toBe(0);
  });
});
