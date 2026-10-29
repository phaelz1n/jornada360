import { snapshotItemsToChecklist } from '../checklist/checklist-adapter.js';

export function backupToChecklistItems(backup) {
  const snapshot = backup?.snapshot || backup?.dias?.[0]?.snapshot;
  return snapshotItemsToChecklist(snapshot?.items || []);
}

export async function readBackupFile(file) {
  if (!file || typeof file.text !== 'function') throw new Error('Arquivo de backup não informado');
  const text = await file.text();
  try { return backupToChecklistItems(JSON.parse(text)); }
  catch (error) { throw new Error(`Backup JSON inválido: ${error.message}`); }
}
