export function parseTimeMinutes(value) {
  const match = String(value || '').match(/\d{1,2}:\d{2}/);
  return match ? Number(match[0].split(':')[0]) * 60 + Number(match[0].split(':')[1]) : null;
}

export function nextDateKey(dateKey) {
  const [year, month, day] = String(dateKey).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function durationFromPairs(values = []) {
  const source = Array.isArray(values) ? values : values && typeof values === 'object' ? Object.values(values) : [];
  const times = source.map(parseTimeMinutes).filter(value => value != null);
  let total = 0;
  for (let index = 0; index + 1 < times.length; index += 2) {
    const end = times[index + 1] < times[index] ? times[index + 1] + 1440 : times[index + 1];
    total += Math.max(0, end - times[index]);
  }
  return total;
}
