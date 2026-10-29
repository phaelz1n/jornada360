function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

export function createMemoryStore(seed = {}) {
  const data = new Map(Object.entries(seed).map(([key, value]) => [key, clone(value)]));
  return {
    async get(path) { return clone(data.get(path)); },
    async set(path, value) { data.set(path, clone(value)); return clone(value); },
    async merge(path, value) {
      const current = data.get(path) || {};
      const next = { ...current, ...value };
      data.set(path, clone(next));
      return clone(next);
    }
  };
}

