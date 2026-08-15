import { WorkspaceRepository } from './WorkspaceRepository';
import type { Department } from '../domain';

export const DepartmentRepository = {
  list(workspaceId: string): Department[] {
    return WorkspaceRepository.getById(workspaceId)?.departments ?? [];
  },

  upsert(workspaceId: string, department: Department): void {
    const ws = WorkspaceRepository.getById(workspaceId);
    if (!ws) return;
    const idx = ws.departments.findIndex((d) => d.id === department.id);
    const departments = [...ws.departments];
    if (idx >= 0) departments[idx] = department;
    else departments.push(department);
    WorkspaceRepository.upsert({ ...ws, departments });
  },

  remove(workspaceId: string, departmentId: string): void {
    const ws = WorkspaceRepository.getById(workspaceId);
    if (!ws) return;
    WorkspaceRepository.upsert({ ...ws, departments: ws.departments.filter((d) => d.id !== departmentId) });
  },

  /* Fonte única das opções de setor mostradas ao resolver uma pendência (React) e dentro do
   * Assistente HE Diário (motor, via querystring) — nunca uma lista separada guardada em paralelo.
   * Ver domain/WorkspaceConfig.ts.
   *
   * Deduplica por nome: dois setores com o mesmo nome (possível se alguém cadastrar duas vezes)
   * gerariam duas opções idênticas no seletor — indistinguíveis para quem escolhe, já que o que é
   * gravado no caso é o NOME do setor, não o id. */
  listNomes(workspaceId: string): string[] {
    const nomes = this.list(workspaceId)
      .map((d) => d.nome.trim())
      .filter(Boolean);
    return [...new Set(nomes)];
  },
};
