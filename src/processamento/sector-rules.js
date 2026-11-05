import { normalizeDriverName } from './processamento-model.js';

const SECTOR_POLICIES = Object.freeze({
  ADM: Object.freeze({ trackerRequired: false, standardRequired: false, weekdayBaseMinutes: 480, saturdayBaseMinutes: 240 }),
  RESERVA: Object.freeze({ trackerRequired: false, standardRequired: false, weekdayBaseMinutes: 440, saturdayBaseMinutes: 440 })
});

export function getSectorPolicy(sector = '', dateKey = '') {
  const key = normalizeDriverName(sector);
  const policy = SECTOR_POLICIES[key];
  if (!policy) return { trackerRequired: true, standardRequired: true, baseMinutes: null, key: key || 'PADRAO' };
  const [year, month, day] = String(dateKey).split('-').map(Number);
  const saturday = year && month && day ? new Date(Date.UTC(year, month - 1, day)).getUTCDay() === 6 : false;
  return { ...policy, baseMinutes: saturday ? policy.saturdayBaseMinutes : policy.weekdayBaseMinutes, key };
}

export function isCoverageSector(sector = '') {
  const key = normalizeDriverName(sector);
  return ['RESERVA', 'FOLGUISTA', 'COBRE FERIAS', 'COBRE FERIAS'].includes(key);
}

export { SECTOR_POLICIES };
