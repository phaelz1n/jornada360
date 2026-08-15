import type { Company } from './Company';
import { empresaVazia } from './Company';
import type { Unit } from './Unit';
import type { Department } from './Department';
import type { Employee } from './Employee';
import type { Schedule } from './Schedule';
import type { Rules } from './Rules';
import { regrasPadrao } from './Rules';
import type { IntegrationConfig } from './IntegrationConfig';
import { integracoesPadrao } from './IntegrationConfig';
import type { UserAccess } from './UserAccess';

export type Environment = 'real' | 'demo';

/* Um Workspace = uma empresa-cliente configurada. Trocar de workspace troca empresa, unidades,
 * setores, colaboradores, escalas, regras e integrações de uma vez — sem alterar código.
 *
 * Não existe campo `setorOpts`: as opções de setor mostradas ao atribuir uma pendência são
 * DERIVADAS de `departments` (nome de cada setor cadastrado), nunca uma lista separada — pra não
 * ter duas fontes de verdade pra mesma informação (ver DepartmentRepository e Fase 1.1). */
export interface WorkspaceConfig {
  id: string;
  environment: Environment;
  company: Company;
  units: Unit[];
  departments: Department[];
  employees: Employee[];
  schedules: Schedule[];
  causaOpts: string[];
  rules: Rules;
  integrations: IntegrationConfig[];
  users: UserAccess[];
  criadoEm: string;
}

/* Defaults NEUTROS — aplicados a qualquer workspace novo, real ou demo. Nenhum valor aqui é
 * específico de uma operação/empresa real; onde não existe um valor genérico defensável (ex.: meta
 * diária de HE), o campo nasce zerado, forçando configuração explícita em vez de herdar um número
 * de outra empresa silenciosamente. Enriquecimento de exemplo (categorias de causa mais variadas,
 * meta diária de demonstração, setores pré-cadastrados) fica isolado em src/demo/seedDemo.ts,
 * aplicado só ao workspace `demo` — nunca aqui. */
export function novoWorkspace(id: string, environment: Environment, nomeEmpresa: string): WorkspaceConfig {
  return {
    id,
    environment,
    company: { ...empresaVazia(), nome: nomeEmpresa },
    units: [],
    departments: [],
    employees: [],
    schedules: [],
    causaOpts: ['Autorizado antecipadamente', 'Escala desatualizada', 'Erro de registro', 'Outro'],
    rules: regrasPadrao(),
    integrations: integracoesPadrao(),
    users: [{ id: 'u1', nome: 'Administrador', papel: 'administrador' }],
    criadoEm: new Date().toISOString(),
  };
}
