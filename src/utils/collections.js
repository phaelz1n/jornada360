export function asArray(value) {
  return Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : [];
}
