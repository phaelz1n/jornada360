export function dedupeSnapshots(snapshots = []) {
  const byDate = new Map();
  const source = Array.isArray(snapshots) ? snapshots : snapshots && typeof snapshots === 'object' ? Object.values(snapshots) : [];
  source.forEach(snapshot => {
    if (!snapshot?.dateKey || snapshot.id === 'latest') return;
    byDate.set(snapshot.dateKey, snapshot);
  });
  return [...byDate.values()].sort((a, b) => String(a.dateKey).localeCompare(String(b.dateKey)));
}
