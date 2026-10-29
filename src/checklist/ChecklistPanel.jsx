import { useEffect, useMemo, useState } from 'react';
import { createChecklistState, toggleAll, toggleOne } from './checklist-model.js';
import { snapshotItemsToChecklist } from './checklist-adapter.js';
import { readBackupFile } from '../dados/backup-loader.js';

const DEMO_ITEMS = snapshotItemsToChecklist([
  { motorista: 'Cristiano Francisco Barreto', setor: 'Motoristas', status: 'ok', totalHE: 120 },
  { motorista: 'Rogerio Rodrigues e Silva', setor: 'Motoristas', totalHE: 80 },
  { motorista: 'Fernando Santos Barcelos', setor: 'Cobre férias', totalHE: 45 }
]);

export function ChecklistPanel({ snapshotItems, dateKey = 'latest' }) {
  const [items] = useState(() => snapshotItemsToChecklist(snapshotItems || DEMO_ITEMS));
  const [backupItems, setBackupItems] = useState(null);
  const [state, setState] = useState(() => createChecklistState(snapshotItemsToChecklist(snapshotItems || DEMO_ITEMS)));
  const [category, setCategory] = useState('Todos');
  const [details, setDetails] = useState({});
  const [loadedRemote, setLoadedRemote] = useState(false);
  const activeItems = backupItems || items;
  useEffect(() => setState(createChecklistState(activeItems)), [activeItems]);
  useEffect(() => {
    let active = true;
    import('../lib/firestore-store.js').then(({ firestoreStore }) => firestoreStore.get(`checklist/${dateKey}`)).then(saved => {
      if (!active || !saved) return;
      setState(current => ({ ...current, validatedIds: saved.validatedIds || [] }));
      setDetails(saved.details || saved.caseState || {});
    }).catch(() => {}).finally(() => { if (active) setLoadedRemote(true); });
    return () => { active = false; };
  }, [dateKey]);
  useEffect(() => {
    if (!activeItems.length || !loadedRemote) return;
    import('../lib/firestore-writes.js').then(({ saveChecklistSnapshot }) => saveChecklistSnapshot({ validatedIds: state.validatedIds, itemIds: state.itemIds, details }, dateKey)).catch(() => {});
  }, [dateKey, state, activeItems, details]);
  const filtered = useMemo(() => category === 'Todos' ? activeItems : activeItems.filter(item => item.setor === category), [category, activeItems]);
  const visibleValidated = filtered.filter(item => state.validatedIds.includes(item.id)).length;
  const allVisible = filtered.length > 0 && visibleValidated === filtered.length;

  async function loadBackup(event) {
    const file = event.target.files?.[0];
    if (file) setBackupItems(await readBackupFile(file));
  }

  return <section className="checklist-panel">
    <div className="checklist-heading"><div><span className="eyebrow">VALIDAÇÃO DO DIA</span><h2>Checklist da jornada</h2><p>Confirme os casos revisados. Você pode validar todos os motoristas visíveis de uma só vez.</p></div><span className="checklist-count">{state.validatedIds.length}/{items.length} validados</span></div>
    <div className="checklist-toolbar"><select value={category} onChange={event => setCategory(event.target.value)} aria-label="Filtrar por categoria"><option>Todos</option><option>Motoristas</option><option>Cobre férias</option><option>Reserva</option><option>Folguista</option></select><button type="button" onClick={() => setState(current => ({ ...current, validatedIds: allVisible ? current.validatedIds.filter(id => !filtered.some(item => item.id === id)) : [...new Set([...current.validatedIds, ...filtered.map(item => item.id)])] }))}>{allVisible ? 'Desmarcar visíveis' : 'Validar todos visíveis'}</button><label className="backup-button">Carregar backup JSON<input type="file" accept=".json" onChange={loadBackup} /></label></div>
    <div className="checklist-list">{filtered.map(item => { const checked = state.validatedIds.includes(item.id); const detail = details[item.id] || {}; const update = (key, value) => setDetails(current => ({ ...current, [item.id]: { ...current[item.id], [key]: value } })); return <div className={`checklist-card ${checked ? 'checked' : ''}`} key={item.id}><label className="checklist-row"><input type="checkbox" checked={checked} onChange={() => setState(current => toggleOne(current, item.id))} /><span className="fake-check">{checked ? '✓' : ''}</span><span className="checklist-person"><strong>{item.motorista}</strong><small>{item.setor} · {item.resumo}</small></span><span className={`check-status ${checked ? 'done' : ''}`}>{checked ? 'Validado' : item.status}</span></label><div className="checklist-details"><input value={detail.justificativa || ''} onChange={event => update('justificativa', event.target.value)} placeholder="Justificativa / observação" /><select value={detail.causa || ''} onChange={event => update('causa', event.target.value)}><option value="">Causa</option><option>Autorizado antecipadamente</option><option>Rastreador com defeito</option><option>Hábito de bater ponto errado</option><option>Ajuste de ponto</option></select><input value={detail.setor || item.setor} onChange={event => update('setor', event.target.value)} placeholder="Setor responsável" /><input value={detail.heCorrigida || ''} onChange={event => update('heCorrigida', event.target.value)} placeholder="HE corrigida (ex.: 00:30)" /></div></div>; })}</div>
  </section>;
}
