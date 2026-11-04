export function createChecklistState(items = []) {
  return { itemIds: items.map(item => item.id), validatedIds: [] };
}

export function mergeChecklistDetails(savedDetails = {}, items = []) {
  const details = { ...savedDetails };
  items.forEach(item => {
    if (!item.justificativaSugerida || details[item.id]?.justificativa?.trim()) return;
    details[item.id] = { ...(details[item.id] || {}), justificativa: item.justificativaSugerida };
  });
  return details;
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
