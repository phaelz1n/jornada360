import { firestoreStore } from '../lib/firestore-store.js';
import { saveFeriasEntity, saveFeriasProgramacao } from '../lib/firestore-writes.js';

export const FERIAS_COLLECTIONS = Object.freeze({
  turnos: 'ferias_turnos',
  feristas: 'ferias_feristas',
  suggestions: 'ferias_sugestoes',
  programs: 'ferias_programacoes'
});

export function subscribeFeriasData({ onTurnos, onFeristas, onSuggestions, onPrograms, onError }) {
  const subscriptions = [
    [FERIAS_COLLECTIONS.turnos, onTurnos],
    [FERIAS_COLLECTIONS.feristas, onFeristas],
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
