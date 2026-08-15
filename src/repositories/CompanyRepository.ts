import { WorkspaceRepository } from './WorkspaceRepository';
import type { Company } from '../domain';

/* Dados cadastrais da empresa dentro de um workspace (nome, CNPJ, identificação, logo, status). */
export const CompanyRepository = {
  get(workspaceId: string): Company | undefined {
    return WorkspaceRepository.getById(workspaceId)?.company;
  },

  update(workspaceId: string, company: Company): void {
    const ws = WorkspaceRepository.getById(workspaceId);
    if (!ws) return;
    WorkspaceRepository.upsert({ ...ws, company });
  },
};
