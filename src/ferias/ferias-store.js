import { firestoreStore } from '../lib/firestore-store.js';
import { saveFeriasEntity, saveFeriasImport, saveFeriasProgramacao } from '../lib/firestore-writes.js';

export const FERIAS_COLLECTIONS = Object.freeze({
  turnos: 'ferias_turnos',
  feristas: 'ferias_feristas',
  people: 'ferias_pessoas',
  personShifts: 'ferias_pessoa_turnos',
  suggestions: 'ferias_sugestoes',
  programs: 'ferias_programacoes'
});

export function subscribeFeriasData({ onTurnos, onFeristas, onPeople, onPersonShifts, onSuggestions, onPrograms, onError }) {
  const subscriptions = [
    [FERIAS_COLLECTIONS.turnos, onTurnos],
    [FERIAS_COLLECTIONS.feristas, onFeristas],
    [FERIAS_COLLECTIONS.people, onPeople],
    [FERIAS_COLLECTIONS.personShifts, onPersonShifts],
    [FERIAS_COLLECTIONS.suggestions, onSuggestions],
    [FERIAS_COLLECTIONS.programs, onPrograms]
  ].filter(([, listener]) => typeof listener === 'function').map(([collection, listener]) => firestoreStore.subscribe(collection, listener, error => onError?.(error)));
  return () => subscriptions.forEach(unsubscribe => unsubscribe?.());
}

export async function persistTurno(turno, actorEmail) {
  return saveFeriasEntity('ferias_turnos', turno, actorEmail);
}

export async function persistFerista(ferista, actorEmail) {
  return saveFeriasEntity('ferias_feristas', ferista, actorEmail);
}

export async function persistSuggestion(suggestion, actorEmail) {
  return saveFeriasEntity('ferias_sugestoes', suggestion, actorEmail);
}

export async function acceptSuggestion(suggestion, actorEmail) {
  return saveFeriasProgramacao(suggestion, actorEmail);
}

export async function persistVacationImport(records, actorEmail, sourceName) {
  return saveFeriasImport(records, actorEmail, sourceName);
}

export async function persistPersonShift(person, shiftId, actorEmail) {
  return saveFeriasEntity('ferias_pessoa_turnos', {
    id: `${person.employeeCode || person.employeeName}-${shiftId}`,
    employeeCode: person.employeeCode,
    employeeName: person.employeeName,
    shiftId,
    effectiveFrom: new Date().toISOString().slice(0, 10),
    status: 'confirmado'
  }, actorEmail);
}
