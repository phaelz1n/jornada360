export function normalizeSnapshotDateKey(value) {
  const text = String(value ?? '').trim();
  const iso = text.match(/^(20\d{2})[-\/](\d{2})[-\/](\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = text.match(/^(\d{2})[-\/](\d{2})[-\/](20\d{2})$/);
  return br ? `${br[3]}-${br[2]}-${br[1]}` : text;
}

export function dedupeSnapshots(snapshots = []) {
  const byDate = new Map();
  const source = Array.isArray(snapshots) ? snapshots : snapshots && typeof snapshots === 'object' ? Object.values(snapshots) : [];
  source.forEach(snapshot => {
    if (!snapshot?.dateKey || snapshot.id === 'latest') return;
    const dateKey = normalizeSnapshotDateKey(snapshot.dateKey);
    if (!dateKey) return;
    byDate.set(dateKey, { ...snapshot, dateKey });
  });
  return [...byDate.values()].sort((a, b) => String(a.dateKey).localeCompare(String(b.dateKey)));
}
