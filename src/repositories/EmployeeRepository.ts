import { WorkspaceRepository } from './WorkspaceRepository';
import type { Employee } from '../domain';

export const EmployeeRepository = {
  list(workspaceId: string): Employee[] {
    return WorkspaceRepository.getById(workspaceId)?.employees ?? [];
  },

  upsert(workspaceId: string, employee: Employee): void {
    const ws = WorkspaceRepository.getById(workspaceId);
    if (!ws) return;
    const idx = ws.employees.findIndex((e) => e.id === employee.id);
    const employees = [...ws.employees];
    if (idx >= 0) employees[idx] = employee;
    else employees.push(employee);
    WorkspaceRepository.upsert({ ...ws, employees });
  },

  remove(workspaceId: string, employeeId: string): void {
    const ws = WorkspaceRepository.getById(workspaceId);
    if (!ws) return;
    WorkspaceRepository.upsert({ ...ws, employees: ws.employees.filter((e) => e.id !== employeeId) });
  },
};
