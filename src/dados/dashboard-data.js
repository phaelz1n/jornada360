function localItems(localBackup) {
  const snapshot = localBackup?.snapshot || localBackup?.dias?.[0]?.snapshot;
  return snapshot?.items || [];
}

export async function buildDashboardData({ store, localBackup } = {}) {
  try {
    const snapshots = (await store?.list?.('snapshots_dias'))?.filter(item => item.dateKey && item.dateKey !== 'latest').sort((a, b) => String(a.dateKey).localeCompare(String(b.dateKey))) || [];
    const remote = snapshots.at(-1) || await store?.get?.('snapshots_dias/latest');
    if (remote?.items?.length) return { items: remote.items, dateKey: remote.dateKey || 'latest', snapshots, source: 'firebase' };
  } catch { /* fallback local is intentional while offline */ }
  return { items: localItems(localBackup), snapshots: [], source: 'local' };
}
