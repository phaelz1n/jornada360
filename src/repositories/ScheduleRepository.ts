import { WorkspaceRepository } from './WorkspaceRepository';
import type { Schedule } from '../domain';

export const ScheduleRepository = {
  list(workspaceId: string): Schedule[] {
    return WorkspaceRepository.getById(workspaceId)?.schedules ?? [];
  },

  upsert(workspaceId: string, schedule: Schedule): void {
    const ws = WorkspaceRepository.getById(workspaceId);
    if (!ws) return;
    const idx = ws.schedules.findIndex((s) => s.id === schedule.id);
    const schedules = [...ws.schedules];
    if (idx >= 0) schedules[idx] = schedule;
    else schedules.push(schedule);
    WorkspaceRepository.upsert({ ...ws, schedules });
  },

  remove(workspaceId: string, scheduleId: string): void {
    const ws = WorkspaceRepository.getById(workspaceId);
    if (!ws) return;
    WorkspaceRepository.upsert({ ...ws, schedules: ws.schedules.filter((s) => s.id !== scheduleId) });
  },
};
