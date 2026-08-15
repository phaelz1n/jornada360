import { WorkspaceRepository } from './WorkspaceRepository';
import type { Unit } from '../domain';

export const UnitRepository = {
  list(workspaceId: string): Unit[] {
    return WorkspaceRepository.getById(workspaceId)?.units ?? [];
  },

  upsert(workspaceId: string, unit: Unit): void {
    const ws = WorkspaceRepository.getById(workspaceId);
    if (!ws) return;
    const idx = ws.units.findIndex((u) => u.id === unit.id);
    const units = [...ws.units];
    if (idx >= 0) units[idx] = unit;
    else units.push(unit);
    WorkspaceRepository.upsert({ ...ws, units });
  },

  remove(workspaceId: string, unitId: string): void {
    const ws = WorkspaceRepository.getById(workspaceId);
    if (!ws) return;
    WorkspaceRepository.upsert({ ...ws, units: ws.units.filter((u) => u.id !== unitId) });
  },
};
