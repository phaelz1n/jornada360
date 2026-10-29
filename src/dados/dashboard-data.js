function localItems(localBackup) {
  const snapshot = localBackup?.snapshot || localBackup?.dias?.[0]?.snapshot;
  return snapshot?.items || [];
}

export async function buildDashboardData({ store, localBackup } = {}) {
  try {
    const remote = await store?.get?.('snapshots_dias/latest');
    if (remote?.items?.length) return { items: remote.items, source: 'firebase' };
  } catch { /* fallback local is intentional while offline */ }
  return { items: localItems(localBackup), source: 'local' };
}
