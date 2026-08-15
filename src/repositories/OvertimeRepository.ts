/* Horas extras vêm do mesmo snapshot diário que o ponto (o motor real calcula os dois juntos —
 * ver `he1min`/`padraoMin`/`excedenteMin` em HEItemRaw). Este repositório existe como um contrato
 * próprio, separado de TimeRecordRepository, porque no modelo de negócio HE é um conceito distinto
 * (programada × realizada × excedente × autorizada) — hoje delega no mesmo storage, mas se um dia
 * a empresa-cliente tiver HE vindo de uma fonte diferente do ponto, só este arquivo muda. */
import { TimeRecordRepository } from './TimeRecordRepository';
import type { HEItemRaw } from '../engine/heEngineCore';

export const OvertimeRepository = {
  listItemsForDay(workspaceId: string, dateKey: string): HEItemRaw[] {
    return TimeRecordRepository.getSnapshot(workspaceId, dateKey)?.items ?? [];
  },

  listAllDays(workspaceId: string): string[] {
    return TimeRecordRepository.listDateKeys(workspaceId);
  },
};
