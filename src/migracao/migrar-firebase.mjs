import { collectAllDrivers } from './motoristas.mjs';

export async function migrateDriversToStore(sources, store) {
  const drivers = collectAllDrivers(sources);
  for (const driver of drivers) {
    await store.merge(`motoristas/${driver.id}`, {
      ...driver,
      atualizadoEm: new Date().toISOString()
    });
  }
  return { migrated: drivers.length, drivers };
}

