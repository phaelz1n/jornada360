import { deleteDoc, doc, setDoc, writeBatch } from 'firebase/firestore';
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

export async function mergeDriverDocuments(keep, remove) {
  const keepId = encodeURIComponent(String(keep?.nome || '').toLowerCase());
  const removeId = encodeURIComponent(String(remove?.nome || '').toLowerCase());
  if (!keepId || !removeId || keepId === removeId) throw new Error('Selecione dois cadastros diferentes.');
  const merged = {
    ...remove,
    ...keep,
    nome: keep.nome,
    horarios: keep.horarios?.length >= 2 ? keep.horarios : remove.horarios || [],
    setor: keep.setor || keep.categoria || remove.setor || remove.categoria || 'Sem setor',
    extraNormalPadrao: keep.extraNormalPadrao ?? keep.extraPrevistaMin ?? remove.extraNormalPadrao ?? remove.extraPrevistaMin ?? 0,
    padraoStatus: keep.padraoStatus || remove.padraoStatus || 'pendente'
  };
  await setDoc(doc(db, 'motoristas', keepId), { ...merged, updatedAt: new Date().toISOString() }, { merge: true });
  await deleteDoc(doc(db, 'motoristas', removeId));
  return keepId;
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

export async function cancelFeriasProgramacao(programacao, actorEmail, reason) {
  const justification = String(reason || '').trim();
  if (!justification) throw new Error('Informe a justificativa do cancelamento.');
  const id = feriasId(programacao);
  const cancelledAt = new Date().toISOString();
  const cancelledBy = actorEmail || auth.currentUser?.email || '';
  const batch = writeBatch(db);
  batch.set(doc(db, 'ferias_programacoes', id), { status: 'cancelada', cancellationReason: justification, cancelledAt, cancelledBy }, { merge: true });
  batch.set(doc(db, 'ferias_auditoria', `programacao-cancelada-${id}-${Date.now()}`), { action: 'ferias_programacao_cancelada', programId: id, reason: justification, actorEmail: cancelledBy, createdAt: cancelledAt });
  await batch.commit();
  return id;
}

export async function saveSystemPermission(permission, actorEmail) {
  const email = String(permission.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) throw new Error('Informe um e-mail válido.');
  const updatedAt = new Date().toISOString();
  const id = encodeURIComponent(email);
  const systemKeys = Object.keys(permission).filter(key => key !== 'email');
  const payload = { email, ...Object.fromEntries(systemKeys.map(key => [key, Boolean(permission[key])])), updatedAt, updatedBy: actorEmail || auth.currentUser?.email || '' };
  const batch = writeBatch(db);
  batch.set(doc(db, 'permissoes_sistemas', id), payload, { merge: true });
  batch.set(doc(db, 'ferias_auditoria', `permission-${id}-${Date.now()}`), { action: 'permissao_sistema_atualizada', email, actorEmail: payload.updatedBy, createdAt: updatedAt });
  await batch.commit();
  return id;
}

export async function saveFeriasImport(records, actorEmail, sourceName = '', importId) {
  const finalImportId = importId || `ferias-${encodeURIComponent(String(sourceName).toLowerCase().replace(/[^a-z0-9]+/g, '-'))}-${records.length}`;
  const createdAt = new Date().toISOString();
  const batch = writeBatch(db);
  batch.set(doc(db, 'ferias_importacoes', finalImportId), { id: finalImportId, sourceName, itemCount: records.length, createdAt, createdBy: actorEmail || auth.currentUser?.email || '' });
  records.forEach(record => {
    const id = feriasId({ ...record, id: record.employeeCode || record.employeeName });
    batch.set(doc(db, 'ferias_pessoas', id), { ...record, id, importId: finalImportId, updatedAt: createdAt }, { merge: true });
  });
  batch.set(doc(db, 'ferias_auditoria', `import-${finalImportId}`), { action: 'ferias_importacao_criada', importId: finalImportId, itemCount: records.length, actorEmail: actorEmail || auth.currentUser?.email || '', createdAt });
  await batch.commit();
  return finalImportId;
}
