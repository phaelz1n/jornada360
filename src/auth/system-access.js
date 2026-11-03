const ADMIN_EMAIL = 'operacional4@transpinho.com';
const FERIAS_EMAILS = new Set(['operacional4@transpinho.com', 'rh@transpinho.com', 'tielle@transpinho.com']);

export function getSystemAccess(email) {
  const normalized = String(email || '').trim().toLowerCase();
  return Object.freeze({
    admin: normalized === ADMIN_EMAIL,
    jornada: Boolean(normalized),
    ferias: FERIAS_EMAILS.has(normalized)
  });
}

export function canAccessSystem(email, system) {
  return Boolean(getSystemAccess(email)[system]);
}

export const SYSTEM_CATALOG = Object.freeze([
  { id: 'jornada', name: 'Jornada360', description: 'Ponto, escala, rastreador e checklist operacional.', path: '/jornada', tone: 'blue' },
  { id: 'ferias', name: 'Controle de férias', description: 'Planejamento, cobertura, turnos e aprovação do RH.', path: '/ferias', tone: 'green' }
]);
