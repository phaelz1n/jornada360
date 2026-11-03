import { doc, setDoc, writeBatch } from 'firebase/firestore';
import { firebaseApp, auth } from './firebase.js';
import { getFirestore } from 'firebase/firestore';
import { createSnapshotWritePlan } from '../dados/snapshot-write-plan.js';
import { buildImportAudit, createImportSyncPlan } from '../dados/import-sync-plan.js';
import { buildChecklistAudit } from '../dados/checklist-audit.js';
import { validateOccurrence } from '../dados/occurrence-validation.js';
import { buildOccurrenceAudit } from '../dados/occurrence-audit.js';

const db = getFirestore(firebaseApp);

export async function saveImportRecord(record) {
  // A nova exportação do mesmo dia é uma correção/atualização, não um novo lançamento.
  // Usar a data como chave evita duplicidade e permite substituir o pacote inteiro.
  const ref = doc(db, 'importacoes', String(record.dateKey));
  const batch = writeBatch(db);
  batch.set(ref, record);
  batch.set(doc(db, 'historico_auditoria', `import-${encodeURIComponent(String(record.dateKey))}-${encodeURIComponent(String(record.createdAt || 'unknown'))}`), buildImportAudit(record));
  await batch.commit();
  return ref.id;
}

export async function saveChecklistSnapshot(snapshot, dateKey = 'latest') {
  const ref = doc(db, 'checklist', dateKey);
  const updatedAt = new Date().toISOString();
  const batch = writeBatch(db);
  batch.set(ref, { ...snapshot, updatedAt }, { merge: true });
  const auditId = `checklist-${encodeURIComponent(String(dateKey))}-${Date.now()}`;
  batch.set(doc(db, 'historico_auditoria', auditId), buildChecklistAudit(snapshot, dateKey, auth.currentUser?.email, updatedAt));
  await batch.commit();
  return ref.id;
}

export async function saveDriver(driver) {
  const id = encodeURIComponent(String(driver.nome || '').toLowerCase());
  await setDoc(doc(db, 'motoristas', id), { ...driver, updatedAt: new Date().toISOString() }, { merge: true });
  return id;
}

export async function saveOccurrence(event) {
  const validation = validateOccurrence(event);
  if (!validation.valid) throw new Error(validation.errors.join(' '));
  const normalized = { ...event, motorista: String(event.motorista).trim(), observacao: String(event.observacao || '').trim(), minutos: Number(event.minutos) };
  const updatedAt = new Date().toISOString();
  const id = `${normalized.dataKey}-${encodeURIComponent(normalized.motorista.toLowerCase())}-${Date.now()}`;
  const batch = writeBatch(db);
  batch.set(doc(db, 'ocorrencias', id), { ...normalized, updatedAt });
  batch.set(doc(db, 'historico_auditoria', `occurrence-${encodeURIComponent(id)}`), buildOccurrenceAudit(normalized, auth.currentUser?.email, updatedAt));
  await batch.commit();
  return id;
}

export async function saveProcessedDay(day) {
  // Sem merge de propósito: HE corrigida, batidas removidas e paradas atualizadas
  // precisam substituir o conteúdo anterior daquele dia.
  const batch = writeBatch(db);
  createSnapshotWritePlan(day).forEach(write => batch.set(doc(db, write.collection, write.id), write.data, write.merge ? { merge: true } : undefined));
  await batch.commit();
}

export async function saveImportAndProcessedDay(record, day) {
  const batch = writeBatch(db);
  createImportSyncPlan(record, day).forEach(write => batch.set(doc(db, write.collection, write.id), write.data, write.merge ? { merge: true } : undefined));
  await batch.commit();
}

function feriasId(entity) {
  return encodeURIComponent(String(entity.id || entity.employeeCode || entity.name || `registro-${Date.now()}`).trim().toLowerCase());
}

export async function saveFeriasEntity(collectionName, entity, actorEmail) {
  const id = feriasId(entity);
  const updatedAt = new Date().toISOString();
  const payload = { ...entity, updatedAt, updatedBy: actorEmail || auth.currentUser?.email || '' };
  const batch = writeBatch(db);
  batch.set(doc(db, collectionName, id), payload, { merge: true });
  batch.set(doc(db, 'ferias_auditoria', `${collectionName}-${id}-${Date.now()}`), {
    action: 'ferias_entidade_atualizada', collection: collectionName, entityId: id,
    actorEmail: actorEmail || auth.currentUser?.email || '', createdAt: updatedAt
  });
  await batch.commit();
  return id;
}

export async function saveFeriasProgramacao(suggestion, actorEmail) {
  if (suggestion?.status !== 'pronta') throw new Error('A sugestão possui pendências e não pode ser aceita.');
  const id = feriasId(suggestion);
  const acceptedAt = new Date().toISOString();
  const program = { ...suggestion, id, status: 'aprovada', acceptedAt, acceptedBy: actorEmail || auth.currentUser?.email || '' };
  const batch = writeBatch(db);
  batch.set(doc(db, 'ferias_programacoes', id), program);
  batch.set(doc(db, 'ferias_sugestoes', id), { ...suggestion, status: 'aceita', acceptedAt, acceptedBy: program.acceptedBy }, { merge: true });
  batch.set(doc(db, 'ferias_auditoria', `programacao-aceita-${id}-${Date.now()}`), {
    action: 'ferias_programacao_aceita', programId: id, actorEmail: program.acceptedBy, createdAt: acceptedAt
  });
  await batch.commit();
  return id;
}
