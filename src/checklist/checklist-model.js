export function createChecklistState(items = []) {
  return { itemIds: items.map(item => item.id), validatedIds: [] };
}

export function toggleAll(state, items = []) {
  const ids = items.map(item => item.id);
  const allValidated = ids.length > 0 && ids.every(id => state.validatedIds.includes(id));
  return { ...state, itemIds: ids, validatedIds: allValidated ? [] : ids };
}

export function toggleOne(state, itemId) {
  const validatedIds = state.validatedIds.includes(itemId)
    ? state.validatedIds.filter(id => id !== itemId)
    : [...state.validatedIds, itemId];
  return { ...state, validatedIds };
}
